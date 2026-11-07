<?php

namespace App\Http\Controllers;

use App\Models\Auditoria;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Notificacion;
use App\Models\Producto;
use App\Models\ServicioTecnico;
use App\Models\Usuario;
use App\Models\Venta;
use App\Support\Erp;
use App\Support\Permisos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Datos de la empresa, exportaciones, notificaciones y eventos para las pantallas abiertas
class GestionController extends Controller
{
    private const CAMPOS_EMPRESA = ['razonSocial' => 'razon_social', 'rubro' => 'rubro', 'domicilio' => 'domicilio', 'condicionIva' => 'condicion_iva', 'telefono' => 'telefono',
        'email' => 'email', 'cuit' => 'cuit', 'ingresosBrutos' => 'ingresos_brutos', 'inicioActividades' => 'inicio_actividades'];

    private const DATASETS = ['maquinaria' => 'Maquinaria', 'repuestos' => 'Repuestos', 'precios' => 'Lista de precios', 'clientes' => 'Clientes',
        'ventas' => 'Ventas', 'servicios' => 'Servicios técnicos', 'auditoria' => 'Auditoría'];

    // ───── Eventos (reemplazan a Socket.io: Hostinger no permite conexiones permanentes)

    public function eventos()
    {
        return response()->json((object) DB::table('eventos')->pluck('version', 'nombre')->all());
    }

    // ───── Empresa

    private function empresaActual(): Empresa
    {
        return Empresa::firstOrCreate(['id' => 1], ['razon_social' => 'SH Servicios'])->fresh();
    }

    public function empresa()
    {
        return $this->empresaActual();
    }

    public function editarEmpresa(Request $r)
    {
        $d = $r->all();
        $e = $this->empresaActual();
        $antes = $e->toArray();
        $cambios = [];
        foreach (self::CAMPOS_EMPRESA as $entrada => $columna) {
            if (array_key_exists($entrada, $d)) {
                $cambios[$columna] = trim(self::texto($d[$entrada]));
            }
        }
        if (($cambios['razon_social'] ?? null) === '') {
            $this->falla(400, 'La razón social es obligatoria');
        }
        if (array_key_exists('puntoVenta', $d)) {
            $pv = self::numero($d['puntoVenta']);
            if (is_nan($pv) || floor($pv) !== $pv || $pv < 1 || $pv > 9999) {
                $this->falla(400, 'El punto de venta debe ser un número entre 1 y 9999');
            }
            $cambios['punto_venta'] = (int) $pv;
        }
        $e->update($cambios);
        $e = $e->fresh();
        $diferencias = Erp::diferencias($antes, $e->toArray(), array_values(array_diff(array_keys($antes), ['id'])));
        if ($diferencias) {
            Erp::auditar($r, ['accion' => 'settings_change', 'seccion' => 'configuracion', 'descripcion' => 'Modificó los datos de la empresa', 'datos' => $diferencias]);
        }

        return $e;
    }

    // ───── Notificaciones

    // Qué avisos ve cada uno según sus permisos: los de las áreas que maneja y, además, los dirigidos a él
    private function visibles(object $actor)
    {
        $areas = [];
        if (in_array('retiros.gestionar', $actor->permisos, true)) {
            $areas[] = 'INVENTARIO';
        }
        if (in_array('servicios.gestionar', $actor->permisos, true)) {
            $areas[] = 'SERVICIOS';
        }

        return Notificacion::where(fn ($q) => $q->whereIn('area', $areas)->orWhere('usuario_id', $actor->id));
    }

    public function notificaciones(Request $r)
    {
        $actor = $this->actor($r);
        $vistasHasta = Usuario::findOrFail($actor->id)->notif_vistas_hasta;
        $items = $this->visibles($actor)->orderByDesc('creado_en')->orderByDesc('id')->take(30)->get();
        $noLeidas = $this->visibles($actor)->where('creado_en', '>', $vistasHasta)->count();
        // A quién va dirigido cada aviso: al técnico asignado por nombre, o al área completa
        $nombres = Usuario::whereIn('id', $items->pluck('usuario_id')->filter()->unique())->pluck('nombre', 'id');

        return [
            'items' => $items->map(fn ($n) => $n->toArray() + [
                'nueva' => $n->creado_en->gt($vistasHasta),
                'destinatario' => $n->usuario_id !== null ? 'Técnico: '.($nombres[$n->usuario_id] ?? 'asignado') : ($n->area === 'INVENTARIO' ? 'Inventario' : 'Servicios técnicos'),
            ]),
            'noLeidas' => $noLeidas,
        ];
    }

    public function marcarLeidas(Request $r)
    {
        // Con el reloj de la base, el mismo que fecha las notificaciones
        Usuario::whereKey($this->actor($r)->id)->update(['notif_vistas_hasta' => DB::raw('CURRENT_TIMESTAMP(3)')]);

        return ['ok' => true];
    }

    // ───── Exportar: columnas + filas; el frontend arma con eso el Excel, el CSV o el PDF.
    // "principales" son las columnas que van al PDF (el Excel y el CSV llevan todas), igual que en el catálogo

    private static function fecha($d): string
    {
        return $d ? $d->copy()->timezone('America/Argentina/Buenos_Aires')->format('j/n/Y, H:i:s') : '';
    }

    private static function margen(float $costo, float $precio): ?float
    {
        return $costo ? round(($precio - $costo) / $costo * 100, 2) : null;
    }

    // Mismas columnas que la plantilla de importación, así un archivo exportado se puede editar y volver a importar
    private function articulos(string $tipo, bool $conCostos, string $titulo): array
    {
        $lista = Producto::with('categoria')->where('tipo_producto', $tipo)->orderBy('nombre')->get();

        return [
            'titulo' => $titulo,
            'columnas' => ['codigo', 'nombre', 'descripcion', 'categoria', ...($conCostos ? ['costo', 'ganancia'] : []), 'precio', 'stock', 'stock_minimo', 'activo'],
            'principales' => ['codigo', 'nombre', 'categoria', 'precio', 'stock', 'activo'],
            'filas' => $lista->map(fn ($p) => [
                $p->codigo, $p->nombre, $p->descripcion, $p->categoria->nombre,
                ...($conCostos ? [$p->precio_costo, self::margen($p->precio_costo, $p->precio)] : []),
                $p->precio, $p->stock, $p->stock_minimo, $p->activo ? 'si' : 'no',
            ])->all(),
        ];
    }

    private function tabla(string $dataset, bool $conCostos): array
    {
        switch ($dataset) {
            case 'maquinaria':
                return $this->articulos('MAQUINARIA', $conCostos, self::DATASETS['maquinaria']);
            case 'repuestos':
                return $this->articulos('REPUESTO', $conCostos, self::DATASETS['repuestos']);

            case 'precios':
                $lista = Producto::with('categoria')->where('activo', true)->orderBy('tipo_producto')->orderBy('nombre')->get();

                return [
                    'titulo' => self::DATASETS['precios'],
                    'columnas' => ['Código', 'Producto', 'Tipo', 'Categoría', ...($conCostos ? ['Costo', 'Ganancia %'] : []), 'Precio'],
                    'principales' => ['Código', 'Producto', 'Categoría', 'Precio'],
                    'filas' => $lista->map(fn ($p) => [
                        $p->codigo, $p->nombre, $p->tipo_producto === 'MAQUINARIA' ? 'Maquinaria' : 'Repuesto', $p->categoria->nombre,
                        ...($conCostos ? [$p->precio_costo, self::margen($p->precio_costo, $p->precio)] : []), $p->precio,
                    ])->all(),
                ];

            case 'clientes':
                return [
                    'titulo' => self::DATASETS['clientes'],
                    'columnas' => ['Nombre', 'Documento', 'Condición IVA', 'Teléfono', 'Email', 'Dirección', 'Saldo (+ debe / - a favor)'],
                    'principales' => ['Nombre', 'Documento', 'Teléfono', 'Saldo (+ debe / - a favor)'],
                    'filas' => Cliente::conSaldo()->map(fn ($c) => [$c->nombre, $c->documento, $c->condicion_iva, $c->telefono, $c->email, $c->direccion, round($c->saldo, 2)])->all(),
                ];

            case 'ventas':
                $lista = Venta::with(['cliente', 'usuario:id,nombre', 'detallesVenta'])->orderByDesc('creado_en')->get();

                return [
                    'titulo' => self::DATASETS['ventas'],
                    'columnas' => ['Fecha', 'Comprobante', 'Número', 'Cliente', 'Vendedor', 'Medio de pago', 'Productos', 'Saldo aplicado', 'Total'],
                    'principales' => ['Fecha', 'Comprobante', 'Número', 'Cliente', 'Medio de pago', 'Total'],
                    'filas' => $lista->map(fn ($v) => [
                        self::fecha($v->creado_en), $v->tipo_comprobante === 'FACTURA' ? 'Factura' : 'Remito', $v->numero, $v->cliente?->nombre ?? 'Consumidor Final',
                        $v->usuario->nombre, $v->medio_pago, $v->detallesVenta->map(fn ($d) => "{$d->cantidad} x {$d->nombre_producto}")->implode(' | '), $v->saldo_aplicado, $v->total,
                    ])->all(),
                ];

            case 'servicios':
                $lista = ServicioTecnico::with(['cliente', 'tecnico:id,nombre'])->orderByDesc('fecha_ingreso')->get();

                return [
                    'titulo' => self::DATASETS['servicios'],
                    'columnas' => ['Número', 'Ingreso', 'Cliente', 'Equipo', 'Falla', 'Técnico', 'Estado', 'Garantía', 'Mano de obra', 'Medio de pago', 'Total', 'Finalizado'],
                    'principales' => ['Número', 'Ingreso', 'Cliente', 'Equipo', 'Técnico', 'Estado', 'Total'],
                    'filas' => $lista->map(fn ($s) => [
                        $s->id, self::fecha($s->fecha_ingreso), $s->cliente->nombre, $s->equipo, $s->descripcion_falla, $s->tecnico?->nombre ?? 'Sin asignar',
                        $s->estado === 'FINALIZADO' ? 'Finalizado' : 'En curso', $s->en_garantia ? 'si' : 'no', $s->costo_mano_obra, $s->medio_pago, $s->total, self::fecha($s->finalizado_en),
                    ])->all(),
                ];

            case 'auditoria':
                $lista = Auditoria::orderByDesc('id')->take(5000)->get();

                return [
                    'titulo' => self::DATASETS['auditoria'],
                    'columnas' => ['Fecha', 'Usuario', 'Acción', 'Sección', 'Descripción', 'IP', 'Cambios'],
                    'principales' => ['Fecha', 'Usuario', 'Acción', 'Sección', 'Descripción'],
                    'filas' => $lista->map(fn ($a) => [self::fecha($a->creado_en), $a->usuario_nombre ?? 'Sistema', $a->accion, $a->seccion, $a->descripcion, $a->ip, $a->datos ? json_encode($a->datos, JSON_UNESCAPED_UNICODE) : ''])->all(),
                ];

            default:
                $this->falla(404, 'No existe esa exportación');
        }
    }

    public function exportar(Request $r, string $dataset)
    {
        $tabla = $this->tabla($dataset, in_array('productos.costos', $this->actor($r)->permisos, true));
        Erp::auditar($r, ['accion' => 'export', 'seccion' => 'exportar', 'descripcion' => "Exportó {$tabla['titulo']} (".count($tabla['filas']).' fila(s))']);

        return $tabla;
    }
}
