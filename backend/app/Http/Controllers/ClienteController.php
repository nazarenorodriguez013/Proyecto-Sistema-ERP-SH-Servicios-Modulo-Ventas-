<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\MovimientoCuenta;
use App\Models\ServicioTecnico;
use App\Models\Venta;
use App\Support\CuentaCorriente;
use App\Support\Erp;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;

// Clientes y su cuenta corriente
class ClienteController extends Controller
{
    private const CAMPOS_AUDITADOS = ['nombre', 'documento', 'condicionIva', 'telefono', 'email', 'direccion'];
    private const POR_PAGINA = 50;

    public function index()
    {
        return Cliente::conSaldo();
    }

    // Ficha completa: datos, compras, servicios técnicos y movimientos de la cuenta corriente
    public function show($id)
    {
        $c = Cliente::with([
            'ventas' => fn ($q) => $q->with(['detallesVenta', 'usuario:id,nombre'])->orderByDesc('creado_en'),
            'servicios' => fn ($q) => $q->with(['repuestos.producto', 'tecnico:id,nombre'])->orderByDesc('fecha_ingreso'),
            'movimientos' => fn ($q) => $q->whereNull('eliminado_en')->orderByDesc('creado_en'),
        ])->find(self::id($id)) ?? $this->falla(404, 'Cliente no encontrado');
        $c->saldo = CuentaCorriente::calcular($c->movimientos);

        return $c;
    }

    private function campos(array $d): array
    {
        if (array_key_exists('nombre', $d) && (! is_string($d['nombre']) || trim($d['nombre']) === '')) {
            $this->falla(400, 'El nombre del cliente es obligatorio');
        }
        $mapa = ['nombre' => 'nombre', 'documento' => 'documento', 'telefono' => 'telefono', 'email' => 'email', 'direccion' => 'direccion', 'condicionIva' => 'condicion_iva'];
        $campos = [];
        foreach ($mapa as $entrada => $columna) {
            if (array_key_exists($entrada, $d)) {
                $campos[$columna] = $d[$entrada];
            }
        }

        return $campos;
    }

    private function traducir(QueryException $e): never
    {
        self::esDuplicado($e) ? $this->falla(400, 'Ya existe un cliente con ese documento') : throw $e;
    }

    public function store(Request $r)
    {
        $d = $r->all();
        $campos = $this->campos($d);
        if (! isset($campos['nombre'])) {
            $this->falla(400, 'El nombre del cliente es obligatorio');
        }
        try {
            $c = Cliente::create($campos)->fresh();
        } catch (QueryException $e) {
            $this->traducir($e);
        }
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'clientes', 'entidad' => 'cliente', 'entidadId' => $c->id, 'descripcion' => "Creó el cliente {$c->nombre}"]);

        return response()->json($c, 201);
    }

    public function update(Request $r, $id)
    {
        $campos = $this->campos($r->all());
        $c = Cliente::find(self::id($id)) ?? $this->falla(404, 'Cliente no encontrado');
        $antes = $c->toArray();
        try {
            $c->update($campos);
        } catch (QueryException $e) {
            $this->traducir($e);
        }
        $c = $c->fresh();
        $cambios = Erp::diferencias($antes, $c->toArray(), self::CAMPOS_AUDITADOS);
        if ($cambios) {
            Erp::auditar($r, ['accion' => 'update', 'seccion' => 'clientes', 'entidad' => 'cliente', 'entidadId' => $c->id, 'descripcion' => "Modificó el cliente {$c->nombre}", 'datos' => $cambios]);
        }

        return $c;
    }

    // Los pagos eliminados también cuentan: borrar el cliente se llevaría el registro de quién los eliminó
    public function destroy(Request $r, $id)
    {
        $c = Cliente::find(self::id($id)) ?? $this->falla(404, 'Cliente no encontrado');
        if (Venta::where('cliente_id', $c->id)->exists() || MovimientoCuenta::where('cliente_id', $c->id)->exists() || ServicioTecnico::where('cliente_id', $c->id)->exists()) {
            $this->falla(409, 'No se puede eliminar: el cliente tiene compras, pagos o servicios registrados');
        }
        $c->delete();
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'clientes', 'entidad' => 'cliente', 'entidadId' => $c->id, 'descripcion' => "Eliminó el cliente {$c->nombre}"]);

        return response()->noContent();
    }

    // Desde la cuenta del cliente solo se registran pagos: las deudas las genera el punto de venta
    public function registrarPago(Request $r, $id)
    {
        $clienteId = self::id($id);
        $monto = self::numero($r->input('monto'));
        if (is_nan($monto) || $monto <= 0) {
            $this->falla(400, 'El monto debe ser mayor a 0');
        }
        if (! Cliente::whereKey($clienteId)->exists()) {
            $this->falla(400, 'Cliente no encontrado');
        }
        $actor = $this->actor($r);
        $m = MovimientoCuenta::create(['cliente_id' => $clienteId, 'tipo' => 'PAGO', 'concepto' => 'Pago', 'monto' => $monto,
            'registrado_por_id' => $actor->id, 'registrado_por_nombre' => $actor->nombre])->fresh();
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'clientes', 'entidad' => 'cliente', 'entidadId' => $clienteId,
            'descripcion' => 'Registró un pago de '.Erp::pesos($monto)." en la cuenta corriente del cliente #$clienteId"]);

        return response()->json($m, 201);
    }

    // Solo se elimina un movimiento suelto (un pago cargado a mano). No se borra de la base: queda guardado con quién
    // lo eliminó, cuándo y por qué
    public function eliminarMovimiento(Request $r, $id, $movimientoId)
    {
        $m = MovimientoCuenta::with('cliente:id,nombre')->where('cliente_id', self::id($id))->whereNull('eliminado_en')->find(self::id($movimientoId))
            ?? $this->falla(404, 'Movimiento no encontrado');
        if ($m->venta_id) {
            $this->falla(400, 'Este movimiento pertenece a una venta: eliminá la venta desde el historial de compras');
        }
        if ($m->servicio_id) {
            $this->falla(400, 'Este movimiento pertenece a un servicio técnico: eliminalo desde el servicio');
        }
        $actor = $this->actor($r);
        $motivo = self::textoOpcional($r->input('motivo'), 255);
        $m->update(['eliminado_en' => now(), 'eliminado_por_id' => $actor->id, 'eliminado_por_nombre' => $actor->nombre, 'motivo_eliminacion' => $motivo]);

        $datos = ['cliente' => $m->cliente->nombre, 'monto' => $m->monto, 'concepto' => $m->concepto, 'cargadoEl' => $m->creado_en->utc()->toIso8601ZuluString('millisecond')];
        if ($m->registrado_por_nombre) {
            $datos['cargadoPor'] = $m->registrado_por_nombre;
        }
        if ($motivo) {
            $datos['motivo'] = $motivo;
        }
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'clientes', 'entidad' => 'movimiento', 'entidadId' => $m->id,
            'descripcion' => 'Eliminó un pago de '.Erp::pesos($m->monto)." de la cuenta corriente de {$m->cliente->nombre}", 'datos' => $datos]);

        return response()->noContent();
    }

    // Pagos eliminados, del más reciente al más viejo. A diferencia de la auditoría (7 días) no se borran nunca
    public function pagosEliminados(Request $r)
    {
        $texto = trim(self::texto($r->query('q')));
        $consulta = MovimientoCuenta::whereNotNull('eliminado_en');
        if ($texto !== '') {
            $like = self::like($texto);
            $consulta->where(fn ($q) => $q->whereHas('cliente', fn ($c) => $c->where('nombre', 'like', $like))
                ->orWhere('eliminado_por_nombre', 'like', $like)->orWhere('registrado_por_nombre', 'like', $like)->orWhere('motivo_eliminacion', 'like', $like));
        }
        $pagina = max(1, self::id($r->query('pagina')));
        $total = (clone $consulta)->count();

        return [
            'total' => $total, 'pagina' => $pagina, 'paginas' => max(1, (int) ceil($total / self::POR_PAGINA)),
            'pagos' => $consulta->with('cliente:id,nombre')->orderByDesc('eliminado_en')->skip(($pagina - 1) * self::POR_PAGINA)->take(self::POR_PAGINA)->get(),
        ];
    }
}
