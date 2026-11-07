<?php

namespace App\Models;

class ServicioRepuesto extends Modelo
{
    protected $table = 'servicio_repuestos';
    protected $casts = ['precio_unitario' => 'float'];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function servicio()
    {
        return $this->belongsTo(ServicioTecnico::class, 'servicio_id');
    }
}
