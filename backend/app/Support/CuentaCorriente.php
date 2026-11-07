<?php

namespace App\Support;

use App\Models\MovimientoCuenta;

class CuentaCorriente
{
    public const MEDIO = 'Cuenta Corriente';

    // Las ventas y servicios a cuenta suman deuda y los pagos la restan; un saldo negativo es saldo a favor.
    // Los pagos eliminados quedan guardados pero no cuentan.
    public static function calcular($movimientos): float
    {
        $saldo = 0.0;
        foreach ($movimientos as $m) {
            $saldo += $m->tipo === 'PAGO' ? -$m->monto : $m->monto;
        }

        return $saldo;
    }

    public static function saldo(int $clienteId): float
    {
        return self::calcular(MovimientoCuenta::where('cliente_id', $clienteId)->whereNull('eliminado_en')->get(['tipo', 'monto']));
    }

    // Registra el cargo de una venta o servicio y devuelve cuánto saldo a favor se usó. A cuenta corriente se carga el
    // total; con otro medio de pago solo la parte cubierta por el saldo a favor, y el resto se paga en el momento.
    public static function registrarCargo(array $c): float
    {
        $saldoAFavor = max(0, -self::saldo($c['clienteId']));
        $base = ['cliente_id' => $c['clienteId'], 'tipo' => $c['tipo'], 'venta_id' => $c['ventaId'] ?? null, 'servicio_id' => $c['servicioId'] ?? null];

        if ($c['medioPago'] === self::MEDIO) {
            if ($c['total'] > 0) {
                MovimientoCuenta::create($base + ['concepto' => $c['concepto'], 'monto' => $c['total']]);
            }

            return min($saldoAFavor, $c['total']);
        }

        $aplicado = $c['usarSaldo'] ? min($saldoAFavor, $c['total']) : 0;
        if ($aplicado > 0) {
            MovimientoCuenta::create($base + ['concepto' => $c['concepto'].' (saldo a favor aplicado)', 'monto' => $aplicado]);
        }

        return $aplicado;
    }
}
