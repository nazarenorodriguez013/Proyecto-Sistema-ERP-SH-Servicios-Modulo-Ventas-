<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\DetalleVenta;
use App\Models\MovimientoCuenta;
use App\Models\Producto;
use App\Models\Usuario;
use App\Models\Venta;
use App\Support\CuentaCorriente;
use App\Support\Erp;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class VentaController extends Controller
{
    private const CON = ['detallesVenta', 'usuario', 'cliente'];

    public function index()
    {
        return Venta::with(self::CON)->orderByDesc('creado_en')->get();
    }

    // Valida ítems y cantidades, y unifica repetidos para chequear el stock contra la cantidad total de cada producto
    private function unificar(array $items): array
    {
        $cantidades = [];
        foreach ($items as $item) {
            $cantidad = is_array($item) ? ($item['cantidad'] ?? null) : null;
            if (! self::entero($cantidad) || $cantidad <= 0) {
                $this->falla(400, 'La cantidad de cada ítem debe ser un número entero mayor a 0');
            }
            $id = self::id($item['productoId'] ?? null);
            $cantidades[$id] = ($cantidades[$id] ?? 0) + (int) $cantidad;
        }
        ksort($cantidades); // orden fijo por producto: evita bloqueos cruzados entre ventas y servicios

        return $cantidades;
    }

    // El presupuesto solo calcula precios y totales para imprimir: no descuenta stock ni queda guardado
    private function presupuesto(array $cantidades, ?int $clienteId, int $usuarioId): array
    {
        $cliente = $clienteId ? (Cliente::find($clienteId) ?? $this->falla(400, 'Cliente no encontrado')) : null;
        $detalles = [];
        $total = 0.0;
        foreach ($cantidades as $productoId => $cantidad) {
            $p = Producto::with('categoria')->find($productoId) ?? $this->falla(400, 'Producto no encontrado');
            $total += $cantidad * $p->precio;
            $detalles[] = ['id' => 0, 'ventaId' => 0, 'productoId' => $productoId, 'cantidad' => $cantidad, 'precioUnitario' => $p->precio,
                'nombreProducto' => $p->nombre, 'codigoProducto' => $p->codigo, 'producto' => $p->makeHidden('precio_costo')->toArray()];
        }

        return [
            'id' => null, 'numero' => Erp::siguienteNumero('PRESUPUESTO'), 'total' => $total, 'tipoComprobante' => 'PRESUPUESTO', 'medioPago' => null, 'montoRecibido' => null,
            'saldoAplicado' => 0, 'usuarioId' => $usuarioId, 'clienteId' => $clienteId, 'creadoEn' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
            'detallesVenta' => $detalles, 'cliente' => $cliente, 'usuario' => Usuario::find($usuarioId),
        ];
    }

    // El precio y el total se calculan con los datos de la base: del frontend solo se aceptan producto y cantidad.
    // El vendedor sale del token, no del cuerpo del pedido
    public function store(Request $r)
    {
        $items = $r->input('items');
        if (! is_array($items) || ! $items) {
            $this->falla(400, 'El comprobante no tiene productos');
        }
        $medioPago = $r->input('medioPago') ?? 'Efectivo';
        $clienteId = $r->input('clienteId') ? self::id($r->input('clienteId')) : null;
        $tipo = $r->input('tipoComprobante') ?? 'FACTURA';
        $usuarioId = $this->actor($r)->id;

        if ($medioPago === CuentaCorriente::MEDIO && ! $clienteId) {
            $this->falla(400, 'Para vender a cuenta corriente hay que seleccionar un cliente');
        }
        if (! in_array($tipo, ['FACTURA', 'REMITO', 'PRESUPUESTO'], true)) {
            $this->falla(400, 'Los datos enviados no son válidos');
        }
        $cantidades = $this->unificar($items);

        if ($tipo === 'PRESUPUESTO') {
            $presupuesto = $this->presupuesto($cantidades, $clienteId, $usuarioId);

            return response()->json($presupuesto, 201);
        }

        $montoRecibido = $r->input('montoRecibido');
        $usarSaldo = $r->input('usarSaldo') !== false;

        // Todo en una transacción: si falla el descuento de stock de cualquier ítem, se revierte la venta entera
        $venta = DB::transaction(function () use ($cantidades, $clienteId, $tipo, $medioPago, $montoRecibido, $usarSaldo, $usuarioId) {
            if ($clienteId && ! Cliente::whereKey($clienteId)->exists()) {
                $this->falla(400, 'Cliente no encontrado');
            }

            $detalles = [];
            $total = 0.0;
            foreach ($cantidades as $productoId => $cantidad) {
                // Bloquea el producto: mientras tanto un servicio no puede reservar la misma unidad
                $p = Producto::lockForUpdate()->find($productoId) ?? $this->falla(400, 'Producto no encontrado');
                if (! $p->activo) {
                    $this->falla(400, "\"{$p->nombre}\" no está disponible para la venta");
                }
                // Lo reservado para servicios técnicos (pedido y todavía no retirado) no se puede vender
                $reservado = Producto::reservado($p->id);
                if ($p->stock - $reservado < $cantidad) {
                    $aviso = $reservado > 0 ? ", $reservado reservado".($reservado > 1 ? 's' : '').' para servicios técnicos' : '';
                    $this->falla(400, "Stock insuficiente para \"{$p->nombre}\" (disponible: ".max($p->stock - $reservado, 0)."$aviso)");
                }
                $p->decrement('stock', $cantidad);
                $total += $cantidad * $p->precio;
                $detalles[] = ['producto_id' => $productoId, 'nombre_producto' => $p->nombre, 'codigo_producto' => $p->codigo, 'cantidad' => $cantidad, 'precio_unitario' => $p->precio];
            }

            $nueva = Venta::create([
                'numero' => Erp::siguienteNumero($tipo), 'total' => $total, 'tipo_comprobante' => $tipo, 'medio_pago' => $medioPago,
                'monto_recibido' => $montoRecibido, 'usuario_id' => $usuarioId, 'cliente_id' => $clienteId,
            ]);
            foreach ($detalles as $d) {
                DetalleVenta::create($d + ['venta_id' => $nueva->id]);
            }

            if ($clienteId) {
                // Con cliente: la venta pasa por su cuenta corriente, que descuenta primero el saldo a favor
                $aplicado = CuentaCorriente::registrarCargo([
                    'clienteId' => $clienteId, 'tipo' => 'VENTA', 'concepto' => "Venta #{$nueva->id}", 'total' => $total,
                    'medioPago' => $medioPago, 'usarSaldo' => $usarSaldo, 'ventaId' => $nueva->id,
                ]);
                // El comprobante lleva el saldo de la cuenta corriente que quedó después de esta venta
                $nueva->update(['saldo_aplicado' => $aplicado, 'saldo_cliente' => CuentaCorriente::saldo($clienteId)]);
            }

            return $nueva;
        }, 3);

        // Se avisa recién cuando la transacción quedó confirmada
        Erp::emitir('stock-actualizado');
        $venta = Venta::with(self::CON)->find($venta->id);
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'ventas', 'entidad' => 'venta', 'entidadId' => $venta->id,
            'descripcion' => 'Registró '.($tipo === 'REMITO' ? 'el remito' : 'la factura')." N° {$venta->numero} por ".Erp::pesos($venta->total)." ({$venta->medio_pago})"]);

        return response()->json($venta, 201);
    }

    // Elimina el comprobante: devuelve el stock vendido y saca la deuda que había generado en la cuenta del cliente
    public function destroy(Request $r, $id)
    {
        $id = self::id($id);
        DB::transaction(function () use ($id) {
            $venta = Venta::with('detallesVenta')->find($id) ?? $this->falla(404, 'Venta no encontrada');
            foreach ($venta->detallesVenta->whereNotNull('producto_id')->sortBy('producto_id') as $d) {
                Producto::whereKey($d->producto_id)->increment('stock', $d->cantidad);
            }
            MovimientoCuenta::where('venta_id', $id)->delete();
            DetalleVenta::where('venta_id', $id)->delete();
            $venta->delete();
        }, 3);

        Erp::emitir('stock-actualizado');
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'ventas', 'entidad' => 'venta', 'entidadId' => $id, 'descripcion' => "Anuló la venta #$id (se devolvió el stock y se revirtió la deuda)"]);

        return response()->noContent();
    }
}
