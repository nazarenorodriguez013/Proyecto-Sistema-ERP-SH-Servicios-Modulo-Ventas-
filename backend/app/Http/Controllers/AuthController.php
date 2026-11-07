<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use App\Support\Correo;
use App\Support\Credenciales;
use App\Support\Erp;
use App\Support\ErrorHttp;
use App\Support\Permisos;
use App\Support\Tokens;
use App\Support\Totp;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class AuthController extends Controller
{
    private const INTENTOS_POR_TANDA = 5;
    private const BLOQUEOS_MIN = [5, 15, 60, 360]; // cada tanda de intentos fallidos bloquea más tiempo
    private const VALIDEZ_CODIGO = 600;
    private const ESPERA_REENVIO = 60;
    private const MAX_INTENTOS_CODIGO = 5;
    private const SIN_TOTP = ['totp_secreto' => null, 'totp_pendiente' => null, 'totp_ultimo_paso' => null];
    private const SIN_CODIGO = ['codigo_hash' => null, 'codigo_expira' => null, 'codigo_proposito' => null];

    // Con secreto de Google Authenticator el código sale de la app; si no, llega por mail
    private function metodoDosPasos(Usuario $u): ?string
    {
        return ! $u->dos_pasos ? null : ($u->totp_secreto ? 'app' : 'correo');
    }

    // Rol y permisos actuales: el frontend arma el menú con eso (la API los vuelve a validar en cada pedido)
    private function datosDeSesion(int $id): array
    {
        $u = Usuario::with('rol.permisos')->findOrFail($id);

        return [
            'id' => $u->id, 'nombre' => $u->nombre, 'correo' => $u->correo, 'dosPasos' => $u->dos_pasos, 'dosPasosMetodo' => $this->metodoDosPasos($u),
            'debeCambiarContrasena' => $u->debe_cambiar_contrasena,
            'rol' => ['id' => $u->rol->id, 'nombre' => $u->rol->nombre, 'slug' => $u->rol->slug], 'permisos' => Permisos::deRol($u->rol),
        ];
    }

    private function emitirSesion(int $id): array
    {
        return ['token' => Tokens::sesion($id), 'user' => $this->datosDeSesion($id)];
    }

    // Ingreso completo: se registra cuándo y desde dónde, y se olvidan los intentos fallidos
    private function iniciarSesion(int $id, Request $r): array
    {
        Usuario::whereKey($id)->update(['ultimo_acceso' => now(), 'ultima_ip' => $r->ip(), 'intentos_fallidos' => 0, 'bloqueos_seguidos' => 0, 'bloqueado_hasta' => null]);
        Erp::purgarAuditoria();

        return $this->emitirSesion($id);
    }

    private function buscarPorCorreo(string $correo): ?Usuario
    {
        return Usuario::where('correo', trim($correo))->first();
    }

    private function verificarBloqueo(Usuario $u): void
    {
        if ($u->bloqueado_hasta && $u->bloqueado_hasta->isFuture()) {
            $min = (int) ceil(now()->diffInSeconds($u->bloqueado_hasta) / 60);
            $this->falla(429, "La cuenta está bloqueada por intentos fallidos. Probá de nuevo en $min minuto".($min === 1 ? '' : 's').' o pedile al administrador que la desbloquee');
        }
    }

    private function registrarFallo(Usuario $u): void
    {
        $intentos = $u->intentos_fallidos + 1;
        if ($intentos < self::INTENTOS_POR_TANDA) {
            $u->update(['intentos_fallidos' => $intentos]);

            return;
        }
        $minutos = self::BLOQUEOS_MIN[min($u->bloqueos_seguidos, count(self::BLOQUEOS_MIN) - 1)];
        $u->update(['intentos_fallidos' => 0, 'bloqueos_seguidos' => $u->bloqueos_seguidos + 1, 'bloqueado_hasta' => now()->addMinutes($minutos)]);
    }

    // Deja en la auditoría los ingresos y los intentos fallidos (con el correo que se probó)
    private function conAuditoria(Request $r, string $intento, Closure $accion)
    {
        $detalle = $intento !== '' ? " ($intento)" : '';
        try {
            $resultado = $accion();
            if (isset($resultado['user'])) {
                Erp::auditar($r, ['accion' => 'login', 'seccion' => 'acceso', 'descripcion' => "Ingresó al sistema$detalle",
                    'usuario' => ['id' => $resultado['user']['id'], 'nombre' => $resultado['user']['nombre']]]);
            }

            return $resultado;
        } catch (Throwable $e) {
            $motivo = $e instanceof ErrorHttp ? $e->getMessage() : 'error interno';
            Erp::auditar($r, ['accion' => 'login_failed', 'seccion' => 'acceso', 'descripcion' => "Intento de ingreso fallido$detalle: $motivo", 'usuario' => null]);
            throw $e;
        }
    }

    // Mismo mensaje tanto si el correo no existe como si la contraseña es incorrecta, para no revelar cuál de los dos está mal
    public function login(Request $r)
    {
        $correo = self::texto($r->input('correo'));

        return $this->conAuditoria($r, mb_substr($correo, 0, 120), function () use ($r, $correo) {
            $u = $this->buscarPorCorreo($correo);
            if ($u) {
                $this->verificarBloqueo($u);
            }
            if (! $u || ! Credenciales::verificar($r->input('contrasena'), $u->contrasena)) {
                if ($u) {
                    $this->registrarFallo($u);
                }
                $this->falla(401, 'Credenciales inválidas');
            }
            if (! $u->activo) {
                $this->falla(401, 'Tu usuario está desactivado. Consultá con el administrador');
            }

            return $this->pedirSegundoPaso($u, $r);
        });
    }

    // Con verificación en dos pasos, ni la contraseña ni Google alcanzan solos
    private function pedirSegundoPaso(Usuario $u, Request $r): array
    {
        if (! $u->dos_pasos) {
            return $this->iniciarSesion($u->id, $r);
        }
        if ($u->totp_secreto) {
            return ['requiere2fa' => true, 'metodo' => 'app', 'desafio' => Tokens::desafio($u->id)];
        }
        // Si ya se mandó un código hace menos de un minuto ese sigue vigente: se muestra igual la pantalla del código
        try {
            $this->enviarCodigo($u, 'login');
        } catch (ErrorHttp $e) {
            if ($e->status !== 429) {
                throw $e;
            }
        }

        return ['requiere2fa' => true, 'metodo' => 'correo', 'desafio' => Tokens::desafio($u->id), 'correo' => preg_replace('/^(.).*(@.*)$/', '$1***$2', $u->correo)];
    }

    private function leerDesafio($desafio): int
    {
        try {
            return Tokens::leerDesafio(self::texto($desafio));
        } catch (Throwable) {
            $this->falla(401, 'La verificación venció. Iniciá sesión de nuevo');
        }
    }

    // Solo se guarda un hash con el usuario y el servidor como sal: un código de 6 dígitos sin eso se adivinaría al instante
    private function hashCodigo(int $id, string $codigo): string
    {
        return hash_hmac('sha256', "$id:$codigo", config('erp.jwt_secret'));
    }

    private function enviarCodigo(Usuario $u, string $proposito): void
    {
        if ($u->codigo_expira && now()->timestamp - ($u->codigo_expira->timestamp - self::VALIDEZ_CODIGO) < self::ESPERA_REENVIO) {
            $this->falla(429, 'Esperá un minuto antes de pedir otro código');
        }
        $codigo = (string) random_int(100000, 999999);
        $u->update(['codigo_hash' => $this->hashCodigo($u->id, $codigo), 'codigo_expira' => now()->addSeconds(self::VALIDEZ_CODIGO), 'codigo_intentos' => 0, 'codigo_proposito' => $proposito]);

        $para = $proposito === 'login' ? 'iniciar sesión en' : 'activar la verificación en dos pasos de';
        try {
            $enviado = Correo::enviar($u->correo, "Tu código de verificación: $codigo",
                "Hola {$u->nombre},\n\nTu código para $para SH Servicios es:\n\n$codigo\n\nVale 10 minutos. Si no fuiste vos, cambiá tu contraseña.");
        } catch (Throwable $e) {
            Log::error('No se pudo enviar el código: '.$e->getMessage());
            $enviado = false;
        }
        // Para activar hace falta que el mail llegue de verdad, si no el usuario podría quedar sin poder entrar
        if (! $enviado && $proposito === 'activar') {
            $this->falla(503, 'No se pudo enviar el mail. Avisale al administrador para que revise la configuración de correo');
        }
    }

    private function verificarCodigo(int $id, $codigo, string $proposito): Usuario
    {
        $u = Usuario::find($id);
        if (! $u?->codigo_hash || ! $u->codigo_expira || $u->codigo_expira->isPast() || $u->codigo_proposito !== $proposito) {
            $this->falla(400, 'El código venció o no se pidió. Pedí uno nuevo');
        }
        if ($u->codigo_intentos >= self::MAX_INTENTOS_CODIGO) {
            $this->falla(429, 'Demasiados intentos. Pedí un código nuevo');
        }
        if (! hash_equals($u->codigo_hash, $this->hashCodigo($id, trim(self::texto($codigo))))) {
            $u->increment('codigo_intentos');
            $this->falla(400, 'Código incorrecto');
        }
        // Un código sirve una sola vez
        $u->update(self::SIN_CODIGO + ['codigo_intentos' => 0]);

        return $u;
    }

    // El código de la app se puede probar sin límite de tiempo, así que los errores cuentan como contraseñas incorrectas
    private function verificarCodigoApp(int $id, $codigo): Usuario
    {
        $u = Usuario::find($id);
        if (! $u?->totp_secreto) {
            $this->falla(401, 'La verificación venció. Iniciá sesión de nuevo');
        }
        $this->verificarBloqueo($u);
        $paso = Totp::verificar(Totp::descifrar($u->totp_secreto), self::texto($codigo), $u->totp_ultimo_paso);
        if ($paso === null) {
            $this->registrarFallo($u);
            $this->falla(400, 'Código incorrecto');
        }
        $u->update(['totp_ultimo_paso' => $paso]);

        return $u;
    }

    public function verificarDosPasos(Request $r)
    {
        return $this->conAuditoria($r, 'verificación en dos pasos', function () use ($r) {
            $id = $this->leerDesafio($r->input('desafio'));
            $conApp = Usuario::whereKey($id)->value('totp_secreto');
            $u = $conApp ? $this->verificarCodigoApp($id, $r->input('codigo')) : $this->verificarCodigo($id, $r->input('codigo'), 'login');
            if (! $u->activo) {
                $this->falla(401, 'Tu usuario está desactivado. Consultá con el administrador');
            }

            return $this->iniciarSesion($u->id, $r);
        });
    }

    public function reenviarCodigo(Request $r)
    {
        $u = Usuario::find($this->leerDesafio($r->input('desafio')));
        if (! $u?->activo || ! $u->dos_pasos) {
            $this->falla(401, 'La verificación venció. Iniciá sesión de nuevo');
        }
        if ($u->totp_secreto) {
            $this->falla(400, 'Tu código está en la app Google Authenticator del celular');
        }
        $this->enviarCodigo($u, 'login');

        return ['message' => 'Te enviamos un código nuevo'];
    }

    // Cada usuario decide si la activa: para prenderla tiene que probar que recibe los mails con un código
    public function solicitarActivacion(Request $r)
    {
        $u = Usuario::findOrFail($this->actor($r)->id);
        if ($u->dos_pasos) {
            $this->falla(400, 'La verificación en dos pasos ya está activada');
        }
        $this->enviarCodigo($u, 'activar');

        return ['message' => 'Te enviamos un código por mail'];
    }

    public function confirmarActivacion(Request $r)
    {
        $id = $this->actor($r)->id;
        $this->verificarCodigo($id, $r->input('codigo'), 'activar')->update(['dos_pasos' => true] + self::SIN_TOTP);

        return $this->emitirSesion($id);
    }

    public function desactivarDosPasos(Request $r)
    {
        $u = Usuario::findOrFail($this->actor($r)->id);
        if (! Credenciales::verificar($r->input('contrasenaActual'), $u->contrasena)) {
            $this->falla(400, 'La contraseña actual no es correcta');
        }
        $u->update(['dos_pasos' => false] + self::SIN_CODIGO + self::SIN_TOTP);

        return $this->emitirSesion($u->id);
    }

    // Se genera un secreto nuevo y queda pendiente hasta que el usuario lo escanea y escribe un código de la app
    public function iniciarApp(Request $r)
    {
        $u = Usuario::findOrFail($this->actor($r)->id);
        if ($u->dos_pasos) {
            $this->falla(400, 'La verificación en dos pasos ya está activada');
        }
        $secreto = Totp::generarSecreto();
        $u->update(['totp_pendiente' => Totp::cifrar($secreto)]);

        return ['secreto' => $secreto, 'qr' => Totp::qr($secreto, $u->correo), 'otpauth' => Totp::urlOtpauth($secreto, $u->correo)];
    }

    public function confirmarApp(Request $r)
    {
        $u = Usuario::findOrFail($this->actor($r)->id);
        if ($u->dos_pasos) {
            $this->falla(400, 'La verificación en dos pasos ya está activada');
        }
        if (! $u->totp_pendiente) {
            $this->falla(400, 'Primero escaneá el código QR');
        }
        $paso = Totp::verificar(Totp::descifrar($u->totp_pendiente), self::texto($r->input('codigo')));
        if ($paso === null) {
            $this->falla(400, 'Código incorrecto. Revisá que sea el de SH Servicios en Google Authenticator y que la hora del celular esté bien');
        }
        $u->update(['dos_pasos' => true, 'totp_secreto' => $u->totp_pendiente, 'totp_pendiente' => null, 'totp_ultimo_paso' => $paso] + self::SIN_CODIGO);
        Erp::auditar($r, ['accion' => 'settings_change', 'seccion' => 'seguridad', 'entidad' => 'usuario', 'entidadId' => $u->id, 'descripcion' => 'Activó la verificación en dos pasos con Google Authenticator']);

        return $this->emitirSesion($u->id);
    }

    // Client ID de Google; sin él el botón no se muestra
    public function config()
    {
        return ['googleClientId' => config('erp.google_client_id') ?: null];
    }

    // Solo entran con Google quienes ya tienen usuario creado por el administrador
    public function loginGoogle(Request $r)
    {
        return $this->conAuditoria($r, 'con Google', function () use ($r) {
            $clientId = config('erp.google_client_id');
            if (! $clientId) {
                $this->falla(503, 'El inicio de sesión con Google no está configurado');
            }
            try {
                $datos = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => self::texto($r->input('credential'))]);
            } catch (Throwable) {
                $this->falla(401, 'No se pudo validar la cuenta de Google');
            }
            if (! $datos->successful() || $datos->json('aud') !== $clientId) {
                $this->falla(401, 'No se pudo validar la cuenta de Google');
            }
            $correo = in_array($datos->json('email_verified'), ['true', true], true) ? $datos->json('email') : null;
            if (! $correo) {
                $this->falla(401, 'La cuenta de Google no tiene un correo verificado');
            }
            $u = $this->buscarPorCorreo($correo);
            if (! $u) {
                $this->falla(403, 'Esa cuenta de Google no tiene acceso. Pedile al administrador que te cree un usuario con ese correo');
            }
            if (! $u->activo) {
                $this->falla(401, 'Tu usuario está desactivado. Consultá con el administrador');
            }
            $this->verificarBloqueo($u);

            return $this->pedirSegundoPaso($u, $r);
        });
    }

    public function sesionActual(Request $r)
    {
        return $this->datosDeSesion($this->actor($r)->id);
    }

    // Datos propios: para cambiar correo o contraseña hay que confirmar la contraseña actual
    public function actualizarCuenta(Request $r)
    {
        $u = Usuario::find($this->actor($r)->id) ?? $this->falla(404, 'Usuario no encontrado');
        $d = $r->all();
        $cambios = [];

        if (array_key_exists('nombre', $d)) {
            if (trim(self::texto($d['nombre'])) === '') {
                $this->falla(400, 'El nombre es obligatorio');
            }
            $cambios['nombre'] = trim($d['nombre']);
        }
        $correo = array_key_exists('correo', $d) ? Credenciales::normalizarCorreo($d['correo']) : null;
        if ($correo && $correo !== $u->correo) {
            $cambios['correo'] = $correo;
        }
        if (! empty($d['contrasenaNueva'])) {
            $cambios['contrasena'] = Credenciales::hash(Credenciales::validarContrasena($d['contrasenaNueva']));
            $cambios['debe_cambiar_contrasena'] = false; // si el administrador le pidió cambiarla, con esto ya cumplió
        }
        if ((isset($cambios['correo']) || isset($cambios['contrasena'])) && ! Credenciales::verificar($d['contrasenaActual'] ?? null, $u->contrasena)) {
            $this->falla(400, 'La contraseña actual no es correcta');
        }

        try {
            $u->update($cambios);
        } catch (QueryException $e) {
            self::esDuplicado($e) ? $this->falla(400, 'Ya existe un usuario con ese correo') : throw $e;
        }

        return $this->emitirSesion($u->id);
    }

    // Responde siempre lo mismo exista o no el correo, para no revelar qué usuarios hay cargados
    public function olvideContrasena(Request $r)
    {
        $clave = mb_strtolower(trim(self::texto($r->input('correo'))));
        if ($clave === '') {
            $this->falla(400, 'Ingresá tu correo');
        }
        $respuesta = ['message' => 'Si el correo está registrado, te enviamos un link para recuperar la contraseña'];
        // Un pedido por minuto por correo, para que no se use para llenar de mails a alguien
        if (! Cache::add('olvido:'.sha1($clave), 1, 60)) {
            return $respuesta;
        }

        $u = $this->buscarPorCorreo($clave);
        if ($u?->activo) {
            $token = bin2hex(random_bytes(32));
            $u->update(['reset_token_hash' => hash('sha256', $token), 'reset_expira' => now()->addHour()]);
            // En producción el link sale de APP_URL y no del encabezado Host, que lo controla quien hace el pedido
            $url = app()->isProduction() ? rtrim(config('app.url'), '/') : $r->getSchemeAndHttpHost();
            try {
                Correo::enviar($u->correo, 'Recuperar contraseña - SH Servicios',
                    "Hola {$u->nombre},\n\nPara elegir una contraseña nueva entrá a este link (vale 1 hora):\n$url/?reset=$token\n\nSi no lo pediste vos, ignorá este mensaje.");
            } catch (Throwable $e) {
                Log::error('No se pudo enviar el mail de recuperación: '.$e->getMessage());
            }
        }

        return $respuesta;
    }

    public function restablecerContrasena(Request $r)
    {
        $contrasena = Credenciales::validarContrasena($r->input('contrasena'));
        $u = Usuario::where('reset_token_hash', hash('sha256', self::texto($r->input('token'))))->where('reset_expira', '>', now())->first();
        if (! $u) {
            $this->falla(400, 'El link no es válido o ya venció. Pedí uno nuevo');
        }
        $u->update(['contrasena' => Credenciales::hash($contrasena), 'reset_token_hash' => null, 'reset_expira' => null]);

        return ['message' => 'Contraseña actualizada. Ya podés iniciar sesión'];
    }
}
