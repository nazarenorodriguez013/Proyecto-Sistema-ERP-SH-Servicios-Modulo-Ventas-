<?php

namespace App\Models;

class MovimientoCuenta extends Modelo
{
    protected $table = 'movimientos_cuenta';
    protected $casts = ['monto' => 'float', 'creado_en' => 'datetime', 'eliminado_en' => 'datetime'];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }
}
