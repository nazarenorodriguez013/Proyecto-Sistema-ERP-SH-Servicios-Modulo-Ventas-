<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\MovimientoCuenta;
use App\Models\Producto;
use App\Models\ServicioRepuesto;
use App\Models\ServicioTecnico;
use App\Models\Usuario;
use App\Support\CuentaCorriente;
use App\Support\Erp;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

// Servicios técnicos y cola de retiro de repuestos del depósito
class ServicioController extends Controller
{
    private const CON = ['cliente', 'tecnico:id,nombre', 'repuestos.producto'];
    private const SIGUIENTE_RETIRO = ['PENDIENTE' => 'LISTO', 'LISTO' => 'RETIRADO', 'RETIRADO' => null];

    // Quien no gestiona todos los servicios (el técnico) solo ve y toca los que tiene asignados
    private function soloLosSuyos(object $actor): bool
    {
        return ! in_array('servicios.gestionar', $actor->permisos, true);
    }

    private function avisar(bool $stock = false): void
    {
        Erp::emitir('servicios-actualizados');
        if ($stock) {
            Erp::emitir('stock-actualizado');
        }
    }

    private function codigoDeRetiro(int $id): string
    {
        return 'RT-'.str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    // Lo que realmente se puede prometer de un repuesto: el stock menos lo que otros servicios ya pidieron y no retiraron.
    // El bloqueo evita que dos pedidos simultáneos vean el mismo stock libre y reserven la misma unidad
    private function validarRepuesto(int $productoId, int $cantidad): Producto
    {
        $p = Producto::lockForUpdate()->find($productoId);
        if (! $p?->activo) {
            $this->falla(400, 'Repuesto no disponible');
        }
        if ($p->tipo_producto !== 'REPUESTO') {
            $this->falla(400, "\"{$p->nombre}\" es maquinaria, no un repuesto");
        }
        $disponible = $p->stock - Producto::reservado($productoId);
        if ($disponible < $cantidad) {
            $this->falla(400, "Stock insuficiente para \"{$p->nombre}\" (disponible: ".max($disponible, 0).')');
        }

        return $p;
    }

    // Después de agregar o quitar repuestos, la cola de retiro vuelve al estado que corresponde
    private function recalcularRetiro(int $id): void
    {
        $s = ServicioTecnico::findOrFail($id);
        $items = ServicioRepuesto::where('servicio_id', $id)->get();
        if ($items->isEmpty()) {
            $estado = null;
        } elseif ($items->every(fn ($i) => $i->cantidad_retirada >= $i->cantidad)) {
            $estado = 'RETIRADO';
        } else {
            $estado = $s->estado_retiro === 'LISTO' ? 'LISTO' : 'PENDIENTE';
        }
        // Si el pedido vuelve a quedar pendiente (se agregó un repuesto), las horas anteriores dejan de valer
        $ahora = now();
        $fechas = match ($estado) {
            'RETIRADO' => ['listo_en' => $s->listo_en ?? $ahora, 'retirado_en' => $s->retirado_en ?? $ahora],
            'LISTO' => ['retirado_en' => null],
            default => ['listo_en' => null, 'retirado_en' => null],
        };
        $s->update(['estado_retiro' => $estado, 'codigo_retiro' => $estado ? ($s->codigo_retiro ?? $this->codigoDeRetiro($id)) : $s->codigo_retiro] + $fechas);
    }

    // Trae el servicio verificando el estado esperado y, si es técnico, que esté asignado a él
    private function obtener(int $id, ?object $actor = null): ServicioTecnico
    {
        $s = ServicioTecnico::find($id) ?? $this->falla(404, 'Servicio no encontrado');
        if ($actor && $this->soloLosSuyos($actor) && $s->tecnico_id !== $actor->id) {
            $this->falla(403, 'El servicio está asignado a otro técnico');
        }
        if ($s->estado !== 'EN_CURSO') {
            $this->falla(409, 'La acción no corresponde al estado actual del servicio');
        }

        return $s;
    }

    // Mano de obra más repuestos; si el equipo está en garantía no se le cobra al cliente
    private function costoTotal(bool $enGarantia, float $manoObra, iterable $repuestos): float
    {
        if ($enGarantia) {
            return 0.0;
        }
        $total = $manoObra;
        foreach ($repuestos as $r) {
            $total += $r['cantidad'] * $r['precio_unitario'];
        }

        return $total;
    }

    // El costo de mano de obra es solo un estimado inicial: la solicitud rápida desde Ventas no tiene por qué traerlo
    private function validarDatos(array $d): float
    {
        if (trim(self::texto($d['equipo'] ?? null)) === '') {
            $this->falla(400, 'El equipo es obligatorio');
        }
        if (trim(self::texto($d['descripcionFalla'] ?? null)) === '') {
            $this->falla(400, 'La descripción de la falla es obligatoria');
        }
        if (! empty($d['enGarantia'])) {
            return 0.0;
        }
        $costo = self::numero($d['costoManoObra'] ?? 0);

        return is_nan($costo) ? 0.0 : $costo;
    }

    private function fecha($valor): ?Carbon
    {
        if (! $valor) {
            return null;
        }
        try {
            return Carbon::parse(self::texto($valor));
        } catch (Throwable) {
            $this->falla(400, 'La fecha ingresada no es válida');
        }
    }

    private function conDetalle(int $id): ServicioTecnico
    {
        return ServicioTecnico::with(self::CON)->find($id);
    }

    public function index(Request $r)
    {
        $actor = $this->actor($r);
        $consulta = ServicioTecnico::with(self::CON)->orderByDesc('fecha_ingreso');
        if ($this->soloLosSuyos($actor)) {
            $consulta->where('tecnico_id', $actor->id);
        }

        return $consulta->get();
    }

    public function show(Request $r, $id)
    {
        $actor = $this->actor($r);
        $s = ServicioTecnico::with(self::CON)->find(self::id($id)) ?? $this->falla(404, 'Servicio no encontrado');
        if ($this->soloLosSuyos($actor) && $s->tecnico_id !== $actor->id) {
            $this->falla(403, 'El servicio está asignado a otro técnico');
        }

        return $s;
    }

    private function esTecnico(int $id): bool
    {
        return Usuario::tecnicos()->whereKey($id)->where('activo', true)->exists();
    }

    public function store(Request $r)
    {
        $d = $r->all();
        $clienteId = self::id($d['clienteId'] ?? null);
        $tecnicoId = ! empty($d['tecnicoId']) ? self::id($d['tecnicoId']) : null;
        $costo = $this->validarDatos($d);
        $estimada = $this->fecha($d['fechaEstimadaFin'] ?? null);
        if (! Cliente::whereKey($clienteId)->exists()) {
            $this->falla(400, 'Cliente no encontrado');
        }
        // Sin técnico queda como solicitud pendiente de asignar (por ejemplo, la que llega desde el punto de venta)
        if ($tecnicoId && ! $this->esTecnico($tecnicoId)) {
            $this->falla(400, 'El usuario seleccionado no es técnico');
        }
        $repuestos = is_array($d['repuestos'] ?? null) ? $d['repuestos'] : [];
        // Siempre en el mismo orden, así dos pedidos con los mismos repuestos no se traban entre sí
        usort($repuestos, fn ($a, $b) => self::id($a['productoId'] ?? 0) <=> self::id($b['productoId'] ?? 0));

        $id = DB::transaction(function () use ($d, $clienteId, $tecnicoId, $costo, $estimada, $repuestos) {
            $nuevo = ServicioTecnico::create([
                'cliente_id' => $clienteId, 'tecnico_id' => $tecnicoId, 'equipo' => trim($d['equipo']), 'descripcion_falla' => trim($d['descripcionFalla']),
                'tareas' => self::textoOpcional($d['tareas'] ?? null), 'en_garantia' => ! empty($d['enGarantia']), 'costo_mano_obra' => $costo,
                'fecha_estimada_fin' => $estimada, 'estado' => 'EN_CURSO', 'estado_retiro' => $repuestos ? 'PENDIENTE' : null,
            ]);
            foreach ($repuestos as $item) {
                if (! self::entero($item['cantidad'] ?? null) || $item['cantidad'] <= 0) {
                    $this->falla(400, 'La cantidad de cada repuesto debe ser un número entero mayor a 0');
                }
                $p = $this->validarRepuesto(self::id($item['productoId'] ?? null), (int) $item['cantidad']);
                ServicioRepuesto::create(['servicio_id' => $nuevo->id, 'producto_id' => $p->id, 'nombre_producto' => $p->nombre, 'codigo_producto' => $p->codigo,
                    'cantidad' => (int) $item['cantidad'], 'precio_unitario' => $p->precio]);
            }
            // El código de retiro identifica al servicio en la cola del depósito de repuestos
            if ($repuestos) {
                $nuevo->update(['codigo_retiro' => $this->codigoDeRetiro($nuevo->id)]);
            }

            return $nuevo->id;
        }, 3);

        $s = $this->conDetalle($id);
        $this->avisar();
        $resumen = "{$s->equipo} ({$s->cliente->nombre})";
        if ($repuestos) {
            $detalle = $s->repuestos->map(fn ($x) => "{$x->cantidad} × {$x->nombre_producto}")->implode(', ');
            Erp::notificar(['area' => 'INVENTARIO', 'servicio_id' => $id, 'titulo' => 'Solicitud de repuestos', 'mensaje' => "{$s->codigo_retiro} · $resumen: $detalle"]);
        }
        if (! $s->tecnico_id) {
            Erp::notificar(['area' => 'SERVICIOS', 'servicio_id' => $id, 'titulo' => 'Servicio sin técnico', 'mensaje' => "#$id · $resumen espera que le asignen un técnico"]);
        } else {
            Erp::notificar(['area' => 'SERVICIOS', 'usuario_id' => $s->tecnico_id, 'servicio_id' => $id, 'titulo' => 'Servicio asignado', 'mensaje' => "#$id · $resumen"]);
        }
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'servicios', 'entidad' => 'servicio', 'entidadId' => $id, 'descripcion' => "Registró el servicio #$id · $resumen"]);

        return response()->json($s, 201);
    }

    // Solo calcula y devuelve una vista previa para imprimir: no se guarda nada ni se toca el stock
    public function presupuesto(Request $r)
    {
        $d = $r->all();
        $costo = $this->validarDatos($d);
        $cliente = Cliente::find(self::id($d['clienteId'] ?? null)) ?? $this->falla(400, 'Cliente no encontrado');
        $tecnico = ! empty($d['tecnicoId']) ? Usuario::find(self::id($d['tecnicoId'])) : null;

        $repuestos = [];
        foreach (is_array($d['repuestos'] ?? null) ? $d['repuestos'] : [] as $item) {
            $p = Producto::find(self::id($item['productoId'] ?? null)) ?? $this->falla(400, 'Producto no encontrado');
            $repuestos[] = ['id' => 0, 'cantidad' => $item['cantidad'] ?? 0, 'precioUnitario' => $p->precio, 'precio_unitario' => $p->precio,
                'nombreProducto' => $p->nombre, 'codigoProducto' => $p->codigo, 'producto' => $p->makeHidden('precio_costo')->toArray()];
        }
        $enGarantia = ! empty($d['enGarantia']);

        return response()->json([
            'id' => null, 'numero' => Erp::siguienteNumero('PRESUPUESTO'), 'equipo' => trim($d['equipo']), 'descripcionFalla' => trim($d['descripcionFalla']),
            'tareas' => self::textoOpcional($d['tareas'] ?? null), 'enGarantia' => $enGarantia, 'costoManoObra' => $costo, 'estado' => 'EN_CURSO', 'fechaEstimadaFin' => null,
            'tipoComprobante' => null, 'medioPago' => null, 'total' => $this->costoTotal($enGarantia, $costo, $repuestos), 'saldoAplicado' => 0, 'proximoMantenimiento' => null,
            'codigoRetiro' => null, 'estadoRetiro' => null, 'fechaIngreso' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'), 'finalizadoEn' => null, 'cliente' => $cliente,
            'tecnico' => $tecnico ? ['id' => $tecnico->id, 'nombre' => $tecnico->nombre] : null,
            'repuestos' => array_map(fn ($x) => Arr::except($x, 'precio_unitario'), $repuestos),
        ], 201);
    }

    // Asigna o reasigna el técnico de una solicitud
    public function asignarTecnico(Request $r, $id)
    {
        $s = $this->obtener(self::id($id));
        $tecnicoId = self::id($r->input('tecnicoId'));
        if (! $this->esTecnico($tecnicoId)) {
            $this->falla(400, 'El usuario seleccionado no es técnico');
        }
        $s->update(['tecnico_id' => $tecnicoId]);
        $s = $this->conDetalle($s->id);
        $this->avisar();
        Erp::notificar(['area' => 'SERVICIOS', 'usuario_id' => $tecnicoId, 'servicio_id' => $s->id, 'titulo' => 'Servicio asignado', 'mensaje' => "#{$s->id} · {$s->equipo} ({$s->cliente->nombre})"]);
        Erp::auditar($r, ['accion' => 'update', 'seccion' => 'servicios', 'entidad' => 'servicio', 'entidadId' => $s->id, 'descripcion' => "Asignó el servicio #{$s->id} a ".($s->tecnico?->nombre ?? 'un técnico')]);

        return $s;
    }

    // El técnico (o administración) ajusta el servicio mientras está en curso: mano de obra, fecha estimada y sus notas
    public function actualizar(Request $r, $id)
    {
        $s = $this->obtener(self::id($id), $this->actor($r));
        $d = $r->all();
        $cambios = [];
        if (array_key_exists('costoManoObra', $d)) {
            $costo = self::numero($d['costoManoObra']);
            if (is_nan($costo) || $costo < 0) {
                $this->falla(400, 'La mano de obra debe ser un número mayor o igual a 0');
            }
            $cambios['costo_mano_obra'] = $costo;
        }
        if (array_key_exists('fechaEstimadaFin', $d)) {
            $cambios['fecha_estimada_fin'] = $this->fecha($d['fechaEstimadaFin']);
        }
        if (array_key_exists('diagnostico', $d)) {
            $cambios['diagnostico'] = self::textoOpcional($d['diagnostico']);
        }
        if (array_key_exists('trabajoRealizado', $d)) {
            $cambios['trabajo_realizado'] = self::textoOpcional($d['trabajoRealizado']);
        }
        $s->update($cambios);
        $this->avisar();

        return $this->conDetalle($s->id);
    }

    // Agregar un repuesto lo suma al pedido del depósito: el stock se descuenta cuando lo retiran
    public function agregarRepuesto(Request $r, $id)
    {
        $id = self::id($id);
        $productoId = self::id($r->input('productoId'));
        $cantidad = $r->input('cantidad');
        if (! self::entero($cantidad) || $cantidad <= 0) {
            $this->falla(400, 'La cantidad debe ser un número entero mayor a 0');
        }
        $cantidad = (int) $cantidad;
        $this->obtener($id, $this->actor($r));

        $p = DB::transaction(function () use ($id, $productoId, $cantidad) {
            $p = $this->validarRepuesto($productoId, $cantidad);
            $existente = ServicioRepuesto::where('servicio_id', $id)->where('producto_id', $productoId)->first();
            if ($existente) {
                $existente->increment('cantidad', $cantidad);
            } else {
                ServicioRepuesto::create(['servicio_id' => $id, 'producto_id' => $productoId, 'nombre_producto' => $p->nombre, 'codigo_producto' => $p->codigo,
                    'cantidad' => $cantidad, 'precio_unitario' => $p->precio]);
            }
            $this->recalcularRetiro($id);

            return $p;
        }, 3);

        $this->avisar();
        $s = $this->conDetalle($id);
        Erp::notificar(['area' => 'INVENTARIO', 'servicio_id' => $id, 'titulo' => 'Repuestos agregados a un pedido', 'mensaje' => "{$s->codigo_retiro} · {$s->equipo}: $cantidad × {$p->nombre}"]);

        return $s;
    }

    // Si el repuesto ya se había retirado, al quitarlo vuelve al stock; si todavía no, simplemente se saca del pedido
    public function quitarRepuesto(Request $r, $id, $productoId)
    {
        $id = self::id($id);
        $productoId = self::id($productoId);
        $this->obtener($id, $this->actor($r));
        $devuelto = DB::transaction(function () use ($id, $productoId) {
            $repuesto = ServicioRepuesto::where('servicio_id', $id)->where('producto_id', $productoId)->first() ?? $this->falla(404, 'El repuesto no está cargado en el servicio');
            $repuesto->delete();
            if ($repuesto->cantidad_retirada > 0) {
                Producto::whereKey($productoId)->increment('stock', $repuesto->cantidad_retirada);
            }
            $this->recalcularRetiro($id);

            return $repuesto->cantidad_retirada > 0;
        }, 3);
        $this->avisar($devuelto);

        return $this->conDetalle($id);
    }

    // Cierra el servicio: recién ahora se genera el comprobante y se cobra (antes era solo un estimado)
    public function finalizar(Request $r, $id)
    {
        $id = self::id($id);
        $actor = $this->actor($r);
        $d = $r->all();
        $tipo = $d['tipoComprobante'] ?? null;
        if (! in_array($tipo, ['FACTURA', 'REMITO'], true)) {
            $this->falla(400, 'Tipo de comprobante inválido');
        }
        if (empty($d['medioPago'])) {
            $this->falla(400, 'Seleccioná el medio de pago');
        }
        $mantenimiento = $this->fecha($d['proximoMantenimiento'] ?? null);
        $this->obtener($id, $actor);
        if (ServicioRepuesto::where('servicio_id', $id)->whereColumn('cantidad_retirada', '<', 'cantidad')->exists()) {
            $this->falla(409, 'Hay repuestos que todavía no se retiraron del depósito: retiralos o quitalos del servicio antes de finalizar');
        }

        DB::transaction(function () use ($id, $d, $tipo, $mantenimiento) {
            // Lo último que cargó el técnico (mano de obra y notas) se guarda junto con el cierre
            $s = ServicioTecnico::with('repuestos')->lockForUpdate()->findOrFail($id);
            if ($s->estado !== 'EN_CURSO') {
                $this->falla(409, 'La acción no corresponde al estado actual del servicio');
            }
            if (array_key_exists('costoManoObra', $d)) {
                $costo = self::numero($d['costoManoObra']);
                $s->costo_mano_obra = is_nan($costo) ? 0.0 : $costo;
            }
            if (array_key_exists('diagnostico', $d)) {
                $s->diagnostico = self::textoOpcional($d['diagnostico']);
            }
            if (array_key_exists('trabajoRealizado', $d)) {
                $s->trabajo_realizado = self::textoOpcional($d['trabajoRealizado']);
            }
            $total = $this->costoTotal($s->en_garantia, $s->costo_mano_obra, $s->repuestos);
            // El cobro pasa por la cuenta corriente del cliente, que descuenta primero el saldo a favor
            $aplicado = CuentaCorriente::registrarCargo([
                'clienteId' => $s->cliente_id, 'tipo' => 'SERVICIO', 'concepto' => "Servicio técnico #$id", 'total' => $total,
                'medioPago' => $d['medioPago'], 'usarSaldo' => ($d['usarSaldo'] ?? null) !== false, 'servicioId' => $id,
            ]);
            $s->fill([
                'estado' => 'FINALIZADO', 'tipo_comprobante' => $tipo, 'numero' => Erp::siguienteNumero($tipo), 'medio_pago' => $d['medioPago'], 'total' => $total,
                'saldo_aplicado' => $aplicado, 'saldo_cliente' => CuentaCorriente::saldo($s->cliente_id), 'proximo_mantenimiento' => $mantenimiento, 'finalizado_en' => now(),
            ])->save();
        }, 3);

        $s = $this->conDetalle($id);
        $this->avisar();
        // Si lo cerró el técnico, administración se entera para ver el comprobante
        if ($this->soloLosSuyos($actor)) {
            Erp::notificar(['area' => 'SERVICIOS', 'servicio_id' => $id, 'titulo' => 'Servicio finalizado', 'mensaje' => "#$id · {$s->equipo} ({$s->cliente->nombre}) lo finalizó ".($s->tecnico?->nombre ?? 'el técnico')]);
        }
        Erp::auditar($r, ['accion' => 'update', 'seccion' => 'servicios', 'entidad' => 'servicio', 'entidadId' => $id,
            'descripcion' => "Finalizó el servicio #$id · total ".Erp::pesos($s->total).($s->medio_pago ? " ({$s->medio_pago})" : '')]);

        return $s;
    }

    // Elimina el servicio completo: devuelve al depósito los repuestos y saca la deuda que había generado
    public function destroy(Request $r, $id)
    {
        $id = self::id($id);
        DB::transaction(function () use ($id) {
            $s = ServicioTecnico::with('repuestos')->find($id) ?? $this->falla(404, 'Servicio no encontrado');
            foreach ($s->repuestos as $x) {
                // Si el artículo ya se eliminó del inventario no hay stock para devolver
                if ($x->cantidad_retirada > 0 && $x->producto_id !== null) {
                    Producto::whereKey($x->producto_id)->increment('stock', $x->cantidad_retirada);
                }
            }
            MovimientoCuenta::where('servicio_id', $id)->delete();
            ServicioRepuesto::where('servicio_id', $id)->delete();
            $s->delete();
        }, 3);
        $this->avisar(true);
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'servicios', 'entidad' => 'servicio', 'entidadId' => $id, 'descripcion' => "Eliminó el servicio #$id"]);

        return response()->noContent();
    }

    // Cola del depósito: todo servicio que tiene repuestos para retirar
    public function retiros()
    {
        return ServicioTecnico::with(self::CON)->whereNotNull('estado_retiro')->orderByDesc('fecha_ingreso')->get();
    }

    // El depósito avanza el pedido: PENDIENTE -> LISTO (avisa a Servicios Técnicos) -> RETIRADO (descuenta el stock)
    public function marcarRetiro(Request $r, $id)
    {
        $id = self::id($id);
        $estado = $r->input('estado');

        DB::transaction(function () use ($id, $estado) {
            $s = ServicioTecnico::with('repuestos.producto')->lockForUpdate()->find($id) ?? $this->falla(404, 'Servicio no encontrado');
            if (! $s->estado_retiro) {
                $this->falla(409, 'Este servicio no tiene repuestos para retirar');
            }
            if (self::SIGUIENTE_RETIRO[$s->estado_retiro] !== $estado) {
                $this->falla(409, "No se puede pasar de \"{$s->estado_retiro}\" a \"".self::texto($estado).'"');
            }
            if ($estado === 'RETIRADO') {
                foreach ($s->repuestos->sortBy('producto_id') as $x) {
                    $pendiente = $x->cantidad - $x->cantidad_retirada;
                    if ($pendiente <= 0) {
                        continue;
                    }
                    if ($x->producto_id === null) {
                        $this->falla(400, "El artículo \"{$x->nombre_producto}\" ya no existe en el inventario");
                    }
                    // Descuenta solo si alcanza el stock en ese momento, así nunca queda negativo
                    $hecho = Producto::whereKey($x->producto_id)->where('stock', '>=', $pendiente)->decrement('stock', $pendiente);
                    if (! $hecho) {
                        $hay = $x->producto?->stock ?? 0;
                        $this->falla(400, "Stock insuficiente para \"{$x->nombre_producto}\" (hay $hay, se necesitan $pendiente). Ajustá el stock antes de entregarlo");
                    }
                    $x->update(['cantidad_retirada' => $x->cantidad]);
                }
            }
            $ahora = now();
            $fechas = $estado === 'LISTO' ? ['listo_en' => $ahora] : ['listo_en' => $s->listo_en ?? $ahora, 'retirado_en' => $ahora];
            $s->update(['estado_retiro' => $estado] + $fechas);
        }, 3);

        $s = $this->conDetalle($id);
        $this->avisar($estado === 'RETIRADO');
        if ($estado === 'LISTO') {
            Erp::notificar(['area' => 'SERVICIOS', 'usuario_id' => $s->tecnico_id, 'servicio_id' => $id, 'titulo' => 'Repuestos listos para retirar', 'mensaje' => "{$s->codigo_retiro} · {$s->equipo}: ya están preparados en el depósito"]);
        } else {
            Erp::notificar(['area' => 'INVENTARIO', 'servicio_id' => $id, 'titulo' => 'Retiro confirmado', 'mensaje' => "{$s->codigo_retiro} · {$s->equipo}: se descontó el stock"]);
        }

        return $s;
    }
}
