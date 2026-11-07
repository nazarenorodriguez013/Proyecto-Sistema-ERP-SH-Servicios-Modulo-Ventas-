<?php

namespace App\Models;

use App\Support\CuentaCorriente;

class Cliente extends Modelo
{
    protected $table = 'clientes';
    protected $casts = ['creado_en' => 'datetime', 'actualizado_en' => 'datetime'];

    public function ventas()
    {
        return $this->hasMany(Venta::class, 'cliente_id');
    }

    public function servicios()
    {
        return $this->hasMany(ServicioTecnico::class, 'cliente_id');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoCuenta::class, 'cliente_id');
    }

    // Todos los clientes con su saldo de cuenta corriente
    public static function conSaldo()
    {
        $clientes = self::with(['movimientos' => fn ($q) => $q->whereNull('eliminado_en')->select('cliente_id', 'tipo', 'monto')])->orderBy('nombre')->get();
        foreach ($clientes as $c) {
            $c->saldo = CuentaCorriente::calcular($c->movimientos);
            $c->unsetRelation('movimientos');
        }

        return $clientes;
    }
}
