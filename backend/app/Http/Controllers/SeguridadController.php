<?php

namespace App\Http\Controllers;

use App\Models\Auditoria;
use App\Models\Rol;
use App\Models\RolPermiso;
use App\Models\ServicioTecnico;
use App\Models\Usuario;
use App\Models\Venta;
use App\Support\Credenciales;
use App\Support\Erp;
use App\Support\Permisos;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Usuarios, técnicos, roles y auditoría
class SeguridadController extends Controller
{
    private const CAMPOS_USUARIO = ['id', 'nombre', 'correo', 'activo', 'telefono', 'puesto', 'rolId', 'ultimoAcceso', 'ultimaIp', 'bloqueadoHasta', 'dosPasos', 'debeCambiarContrasena', 'creadoEn'];
    private const CAMPOS_AUDITADOS = ['nombre', 'correo', 'rol', 'telefono', 'puesto', 'activo', 'debeCambiarContrasena', 'dosPasos'];
    private const POR_PAGINA = 50;

    // ───── Usuarios

    private function vistaUsuario(Usuario $u): array
    {
        return Arr::only($u->toArray(), self::CAMPOS_USUARIO) + ['rol' => Arr::only($u->rol->toArray(), ['id', 'nombre', 'slug'])];
    }

    private function duplicado(QueryException $e): never
    {
        self::esDuplicado($e) ? $this->falla(400, 'Ya existe un usuario con ese correo') : throw $e;
    }

    // Solo un administrador puede dar el rol Administrador: así nadie con permiso de usuarios se da acceso total a sí mismo
    private function validarRol($rolId, object $actor): Rol
    {
        $rol = Rol::find(self::id($rolId)) ?? $this->falla(400, 'El rol no es válido');
        if ($rol->slug === Permisos::SLUG_ADMIN && $actor->rolSlug !== Permisos::SLUG_ADMIN) {
            $this->falla(403, 'Solo un administrador puede asignar el rol Administrador');
        }

        return $rol;
    }

    // Siempre tiene que quedar al menos un administrador activo, si no nadie podría volver a gestionar usuarios
    private function quedaOtroAdmin(int $excluir): bool
    {
        return Usuario::whereHas('rol', fn ($q) => $q->where('slug', Permisos::SLUG_ADMIN))->where('activo', true)->where('id', '!=', $excluir)->exists();
    }

    public function usuarios()
    {
        return Usuario::with('rol')->orderBy('nombre')->get()->map(fn ($u) => $this->vistaUsuario($u));
    }

    public function crearUsuario(Request $r)
    {
        $d = $r->all();
        if (! is_string($d['nombre'] ?? null) || trim($d['nombre']) === '') {
            $this->falla(400, 'El nombre es obligatorio');
        }
        $rol = $this->validarRol($d['rolId'] ?? null, $this->actor($r));
        $correo = Credenciales::normalizarCorreo($d['correo'] ?? null);
        $hash = Credenciales::hash(Credenciales::validarContrasena($d['contrasena'] ?? null));
        try {
            $u = Usuario::create([
                'nombre' => mb_substr(trim($d['nombre']), 0, 120), 'correo' => $correo, 'rol_id' => $rol->id, 'contrasena' => $hash,
                'telefono' => self::textoOpcional($d['telefono'] ?? null, 40), 'puesto' => self::textoOpcional($d['puesto'] ?? null, 120),
                'activo' => ($d['activo'] ?? null) !== false, 'debe_cambiar_contrasena' => ($d['debeCambiarContrasena'] ?? null) === true,
            ])->fresh('rol');
        } catch (QueryException $e) {
            $this->duplicado($e);
        }
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'usuarios', 'entidad' => 'usuario', 'entidadId' => $u->id, 'descripcion' => "Creó el usuario {$u->nombre} ({$u->rol->nombre})"]);

        return response()->json($this->vistaUsuario($u), 201);
    }

    public function editarUsuario(Request $r, $id)
    {
        $id = self::id($id);
        $actor = $this->actor($r);
        $d = $r->all();
        $u = Usuario::with('rol')->find($id) ?? $this->falla(404, 'Usuario no encontrado');
        $esAdmin = $u->rol->slug === Permisos::SLUG_ADMIN;
        if ($esAdmin && $actor->rolSlug !== Permisos::SLUG_ADMIN) {
            $this->falla(403, 'Solo un administrador puede modificar a otro administrador');
        }

        $rol = array_key_exists('rolId', $d) && self::id($d['rolId']) !== $u->rol_id ? $this->validarRol($d['rolId'], $actor) : $u->rol;
        $activo = array_key_exists('activo', $d) ? (bool) $d['activo'] : $u->activo;
        if ($esAdmin && $u->activo && ($rol->slug !== Permisos::SLUG_ADMIN || ! $activo) && ! $this->quedaOtroAdmin($id)) {
            $this->falla(400, 'Tiene que quedar al menos un administrador activo');
        }
        if ($id === $actor->id && ! $activo) {
            $this->falla(400, 'No podés desactivar tu propio usuario');
        }

        $cambios = ['rol_id' => $rol->id, 'activo' => $activo];
        // El administrador solo puede apagarla (por ejemplo si perdieron el celular); activarla lo decide cada usuario
        if (($d['dosPasos'] ?? null) === false) {
            $cambios += ['dos_pasos' => false, 'totp_secreto' => null, 'totp_pendiente' => null, 'totp_ultimo_paso' => null];
        }
        if (array_key_exists('nombre', $d)) {
            if (! is_string($d['nombre']) || trim($d['nombre']) === '') {
                $this->falla(400, 'El nombre es obligatorio');
            }
            $cambios['nombre'] = mb_substr(trim($d['nombre']), 0, 120);
        }
        if (array_key_exists('correo', $d)) {
            $cambios['correo'] = Credenciales::normalizarCorreo($d['correo']);
        }
        if (array_key_exists('telefono', $d)) {
            $cambios['telefono'] = self::textoOpcional($d['telefono'], 40);
        }
        if (array_key_exists('puesto', $d)) {
            $cambios['puesto'] = self::textoOpcional($d['puesto'], 120);
        }
        if (array_key_exists('debeCambiarContrasena', $d)) {
            $cambios['debe_cambiar_contrasena'] = $d['debeCambiarContrasena'] === true;
        }
        if (! empty($d['contrasena'])) {
            $cambios['contrasena'] = Credenciales::hash(Credenciales::validarContrasena($d['contrasena']));
        }
        // "Desbloquear intentos fallidos": vuelve a dejarlo entrar sin esperar
        if (($d['desbloquear'] ?? null) === true) {
            $cambios += ['intentos_fallidos' => 0, 'bloqueos_seguidos' => 0, 'bloqueado_hasta' => null];
        }

        $antes = ['rol' => $u->rol->nombre] + $u->toArray();
        try {
            $u->update($cambios);
        } catch (QueryException $e) {
            $this->duplicado($e);
        }
        $u = $u->fresh('rol');
        Erp::emitir('permisos-actualizados');

        $diferencias = Erp::diferencias($antes, ['rol' => $u->rol->nombre] + $u->toArray(), self::CAMPOS_AUDITADOS);
        if (! empty($d['contrasena'])) {
            $diferencias['contrasena'] = ['antes' => '••••', 'ahora' => 'cambiada'];
        }
        if (($d['desbloquear'] ?? null) === true) {
            $diferencias['bloqueo'] = ['antes' => 'bloqueado', 'ahora' => 'desbloqueado'];
        }
        // Desactivar desde el menú es una baja; cualquier otro cambio, una modificación
        $baja = $antes['activo'] && ! $u->activo;
        if ($diferencias) {
            Erp::auditar($r, ['accion' => $baja ? 'deactivate' : 'update', 'seccion' => 'usuarios', 'entidad' => 'usuario', 'entidadId' => $id,
                'descripcion' => ($baja ? 'Desactivó' : 'Modificó')." el usuario {$u->nombre}", 'datos' => $diferencias]);
        }

        return $this->vistaUsuario($u);
    }

    // Eliminar definitivamente (desactivar es una edición con activo = false)
    public function eliminarUsuario(Request $r, $id)
    {
        $id = self::id($id);
        $actor = $this->actor($r);
        if ($id === $actor->id) {
            $this->falla(400, 'No podés eliminar tu propio usuario');
        }
        $u = Usuario::with('rol')->find($id) ?? $this->falla(404, 'Usuario no encontrado');
        $esAdmin = $u->rol->slug === Permisos::SLUG_ADMIN;
        if ($esAdmin && $actor->rolSlug !== Permisos::SLUG_ADMIN) {
            $this->falla(403, 'Solo un administrador puede eliminar a otro administrador');
        }
        if ($esAdmin && $u->activo && ! $this->quedaOtroAdmin($id)) {
            $this->falla(400, 'Tiene que quedar al menos un administrador activo');
        }
        if (Venta::where('usuario_id', $id)->exists() || ServicioTecnico::where('tecnico_id', $id)->exists()) {
            $this->falla(409, 'No se puede eliminar: tiene ventas o servicios registrados. Desactivalo en su lugar');
        }
        $u->delete();
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'usuarios', 'entidad' => 'usuario', 'entidadId' => $id, 'descripcion' => "Eliminó definitivamente el usuario {$u->nombre} ({$u->correo})"]);

        return response()->noContent();
    }

    // ───── Técnicos

    private function vistaTecnico(Usuario $u): array
    {
        return ['id' => $u->id, 'nombre' => $u->nombre, 'correo' => $u->correo, '_count' => ['serviciosAsignados' => (int) $u->servicios_asignados_count]];
    }

    private function validarTecnico(array $d): void
    {
        if (array_key_exists('nombre', $d) && trim(self::texto($d['nombre'])) === '') {
            $this->falla(400, 'El nombre es obligatorio');
        }
        if (array_key_exists('correo', $d) && trim(self::texto($d['correo'])) === '') {
            $this->falla(400, 'El correo es obligatorio');
        }
    }

    // Evita que por esta vía se toque un usuario que no es técnico (por ejemplo, un administrador)
    private function obtenerTecnico(int $id): Usuario
    {
        return Usuario::tecnicos()->find($id) ?? $this->falla(404, 'Técnico no encontrado');
    }

    public function tecnicos()
    {
        return Usuario::tecnicos()->where('activo', true)->withCount('serviciosAsignados')->orderBy('nombre')->get()->map(fn ($u) => $this->vistaTecnico($u));
    }

    // Los técnicos que se dan de alta desde esta pantalla reciben el rol Técnico de sistema
    public function crearTecnico(Request $r)
    {
        $d = $r->all();
        $this->validarTecnico($d);
        Credenciales::validarContrasena($d['contrasena'] ?? null);
        if (! isset($d['nombre'], $d['correo'])) {
            $this->falla(400, 'Los datos enviados no son válidos');
        }
        try {
            $u = Usuario::create(['nombre' => trim($d['nombre']), 'correo' => mb_strtolower(trim($d['correo'])), 'contrasena' => Credenciales::hash($d['contrasena']),
                'rol_id' => Rol::where('slug', 'tecnico')->value('id')]);
        } catch (QueryException $e) {
            $this->duplicado($e);
        }
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'tecnicos', 'entidad' => 'usuario', 'entidadId' => $u->id, 'descripcion' => "Creó el técnico {$u->nombre}"]);

        return response()->json($this->vistaTecnico($u->loadCount('serviciosAsignados')), 201);
    }

    // La contraseña es opcional al editar: si viene vacía se mantiene la actual
    public function editarTecnico(Request $r, $id)
    {
        $d = $r->all();
        $this->validarTecnico($d);
        $u = $this->obtenerTecnico(self::id($id));
        $cambios = [];
        if (isset($d['nombre'])) {
            $cambios['nombre'] = trim($d['nombre']);
        }
        if (isset($d['correo'])) {
            $cambios['correo'] = trim($d['correo']);
        }
        if (! empty($d['contrasena'])) {
            $cambios['contrasena'] = Credenciales::hash(Credenciales::validarContrasena($d['contrasena']));
        }
        try {
            $u->update($cambios);
        } catch (QueryException $e) {
            $this->duplicado($e);
        }
        Erp::auditar($r, ['accion' => 'update', 'seccion' => 'tecnicos', 'entidad' => 'usuario', 'entidadId' => $u->id,
            'descripcion' => "Modificó el técnico {$u->nombre}".(! empty($d['contrasena']) ? ' (cambió la contraseña)' : '')]);

        return $this->vistaTecnico($u->loadCount('serviciosAsignados'));
    }

    public function eliminarTecnico(Request $r, $id)
    {
        $u = $this->obtenerTecnico(self::id($id));
        if (ServicioTecnico::where('tecnico_id', $u->id)->exists()) {
            $this->falla(409, 'No se puede eliminar: el técnico tiene servicios asignados');
        }
        $u->delete();
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'tecnicos', 'entidad' => 'usuario', 'entidadId' => $u->id, 'descripcion' => "Eliminó el técnico {$u->nombre}"]);

        return response()->noContent();
    }

    // ───── Roles

    private function resumenRol(Rol $rol): array
    {
        $permisos = $rol->slug === Permisos::SLUG_ADMIN ? Permisos::todos() : Permisos::normalizar($rol->permisos->pluck('permiso')->all());

        return Arr::except($rol->toArray(), ['permisos', 'usuariosCount']) + ['usuarios' => (int) $rol->usuarios_count, 'permisos' => $permisos];
    }

    private function rolConDetalle(int $id): ?Rol
    {
        return Rol::with('permisos')->withCount('usuarios')->find($id);
    }

    private function validarNombreRol($nombre): string
    {
        $n = is_string($nombre) ? trim($nombre) : '';
        if ($n === '') {
            $this->falla(400, 'El nombre es obligatorio');
        }
        if (mb_strlen($n) > 60) {
            $this->falla(400, 'El nombre no puede tener más de 60 caracteres');
        }

        return $n;
    }

    private function guardarPermisos(int $rolId, array $permisos): void
    {
        RolPermiso::where('rol_id', $rolId)->delete();
        RolPermiso::insert(array_map(fn ($p) => ['rol_id' => $rolId, 'permiso' => $p], $permisos));
    }

    // Los de sistema primero, en el orden en que se crearon; después los personalizados
    public function roles()
    {
        return Rol::with('permisos')->withCount('usuarios')->orderByDesc('es_sistema')->orderBy('id')->get()->map(fn ($x) => $this->resumenRol($x));
    }

    public function rol($id)
    {
        return $this->resumenRol($this->rolConDetalle(self::id($id)) ?? $this->falla(404, 'Rol no encontrado'));
    }

    public function catalogoPermisos()
    {
        return Permisos::MODULOS;
    }

    public function crearRol(Request $r)
    {
        $nombre = $this->validarNombreRol($r->input('nombre'));
        // El slug es único: si ya existe uno igual se le agrega un número
        $base = Str::slug($nombre) ?: 'rol';
        $slug = $base;
        for ($i = 2; Rol::where('slug', $slug)->exists(); $i++) {
            $slug = "$base-$i";
        }
        try {
            $id = DB::transaction(function () use ($r, $nombre, $slug) {
                $rol = Rol::create(['nombre' => $nombre, 'slug' => $slug, 'descripcion' => self::textoOpcional($r->input('descripcion'), 255)]);
                $this->guardarPermisos($rol->id, Permisos::normalizar($r->input('permisos')));

                return $rol->id;
            });
        } catch (QueryException $e) {
            self::esDuplicado($e) ? $this->falla(400, 'Ya existe un rol con ese nombre') : throw $e;
        }
        $rol = $this->resumenRol($this->rolConDetalle($id));
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'roles', 'entidad' => 'rol', 'entidadId' => $id,
            'descripcion' => "Creó el rol {$rol['nombre']} con ".count($rol['permisos']).' permiso(s)', 'datos' => ['permisos' => $rol['permisos']]]);

        return response()->json($rol, 201);
    }

    public function editarRol(Request $r, $id)
    {
        $id = self::id($id);
        $d = $r->all();
        $actor = $this->actor($r);
        $actual = $this->rolConDetalle($id) ?? $this->falla(404, 'Rol no encontrado');
        // Así nadie se agrega permisos a sí mismo editando su propio rol (salvo el administrador, que ya los tiene todos)
        if ($actor->rolSlug !== Permisos::SLUG_ADMIN) {
            if (Usuario::whereKey($actor->id)->value('rol_id') === $id) {
                $this->falla(403, 'No podés modificar los permisos de tu propio rol');
            }
            if ($actual->slug === Permisos::SLUG_ADMIN) {
                $this->falla(403, 'Solo un administrador puede modificar el rol Administrador');
            }
        }
        $antes = $this->resumenRol($actual);

        $cambios = [];
        if (array_key_exists('nombre', $d)) {
            $cambios['nombre'] = $this->validarNombreRol($d['nombre']);
        }
        if (array_key_exists('descripcion', $d)) {
            $cambios['descripcion'] = self::textoOpcional($d['descripcion'], 255);
        }
        // Los roles de sistema no se pueden desactivar (los usuarios quedarían sin acceso a nada)
        if (array_key_exists('activo', $d) && ! $actual->es_sistema) {
            $cambios['activo'] = (bool) $d['activo'];
        }

        try {
            DB::transaction(function () use ($actual, $d, $cambios) {
                // El Administrador conserva siempre todos los permisos: lo que llegue para él se ignora
                if (array_key_exists('permisos', $d) && $actual->slug !== Permisos::SLUG_ADMIN) {
                    $this->guardarPermisos($actual->id, Permisos::normalizar($d['permisos']));
                }
                $actual->update($cambios);
            });
        } catch (QueryException $e) {
            self::esDuplicado($e) ? $this->falla(400, 'Ya existe un rol con ese nombre') : throw $e;
        }
        // Las pantallas abiertas de quienes tienen este rol vuelven a pedir sus permisos
        Erp::emitir('permisos-actualizados');

        $rol = $this->resumenRol($this->rolConDetalle($id));
        $diferencias = Erp::diferencias($antes, $rol, ['nombre', 'descripcion', 'activo']);
        $agregados = array_values(array_diff($rol['permisos'], $antes['permisos']));
        $quitados = array_values(array_diff($antes['permisos'], $rol['permisos']));
        if ($agregados) {
            $diferencias['permisos agregados'] = implode(', ', $agregados);
        }
        if ($quitados) {
            $diferencias['permisos quitados'] = implode(', ', $quitados);
        }
        if ($diferencias) {
            Erp::auditar($r, ['accion' => $agregados || $quitados ? 'permissions_change' : 'update', 'seccion' => 'roles', 'entidad' => 'rol', 'entidadId' => $id,
                'descripcion' => "Modificó el rol {$rol['nombre']}", 'datos' => $diferencias]);
        }

        return $rol;
    }

    public function eliminarRol(Request $r, $id)
    {
        $rol = $this->rolConDetalle(self::id($id)) ?? $this->falla(404, 'Rol no encontrado');
        if ($rol->es_sistema) {
            $this->falla(400, 'Los roles de sistema no se pueden eliminar');
        }
        if ($rol->usuarios_count) {
            $this->falla(409, 'No se puede eliminar: hay usuarios con este rol. Asignales otro rol primero');
        }
        $rol->delete();
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'roles', 'entidad' => 'rol', 'entidadId' => $rol->id, 'descripcion' => "Eliminó el rol {$rol->nombre}"]);

        return response()->noContent();
    }

    // ───── Auditoría

    // "2026-10-09" -> inicio de ese día en Argentina; "hasta" incluye el día completo
    private function fecha($texto, bool $finDelDia = false): ?Carbon
    {
        if (! is_string($texto) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $texto)) {
            return null;
        }
        $d = Carbon::parse($texto, 'America/Argentina/Buenos_Aires');

        return ($finDelDia ? $d->addDay() : $d)->utc();
    }

    public function auditoria(Request $r)
    {
        $consulta = Auditoria::query();
        $q = trim(self::texto($r->query('q')));
        if ($q !== '') {
            $like = self::like($q);
            $consulta->where(fn ($c) => $c->where('descripcion', 'like', $like)->orWhere('usuario_nombre', 'like', $like)->orWhere('ip', 'like', $like));
        }
        if ($r->query('seccion')) {
            $consulta->where('seccion', self::texto($r->query('seccion')));
        }
        if ($r->query('accion')) {
            $consulta->where('accion', self::texto($r->query('accion')));
        }
        if (self::id($r->query('usuario'))) {
            $consulta->where('usuario_id', self::id($r->query('usuario')));
        }
        if ($desde = $this->fecha($r->query('desde'))) {
            $consulta->where('creado_en', '>=', $desde);
        }
        if ($hasta = $this->fecha($r->query('hasta'), true)) {
            $consulta->where('creado_en', '<', $hasta);
        }

        $pagina = max(1, self::id($r->query('pagina')));
        $total = (clone $consulta)->count();

        return [
            'total' => $total, 'pagina' => $pagina, 'paginas' => max(1, (int) ceil($total / self::POR_PAGINA)),
            'eventos' => $consulta->orderByDesc('id')->skip(($pagina - 1) * self::POR_PAGINA)->take(self::POR_PAGINA)->get(),
            // Opciones de los filtros: solo lo que efectivamente aparece en el registro
            'secciones' => Auditoria::distinct()->orderBy('seccion')->pluck('seccion'),
            'acciones' => Auditoria::distinct()->orderBy('accion')->pluck('accion'),
            'usuarios' => Usuario::orderBy('nombre')->get(['id', 'nombre']),
        ];
    }
}
