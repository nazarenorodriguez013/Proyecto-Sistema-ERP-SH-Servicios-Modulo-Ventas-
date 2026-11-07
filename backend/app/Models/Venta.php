<?php

namespace App\Models;

class Venta extends Modelo
{
    protected $table = 'ventas';
    protected $casts = [
        'total' => 'float', 'monto_recibido' => 'float', 'saldo_aplicado' => 'float', 'saldo_cliente' => 'float', 'creado_en' => 'datetime',
    ];

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function detallesVenta()
    {
        return $this->hasMany(DetalleVenta::class, 'venta_id');
    }
}
