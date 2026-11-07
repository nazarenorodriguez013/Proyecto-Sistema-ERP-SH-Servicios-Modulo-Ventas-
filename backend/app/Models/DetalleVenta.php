<?php

namespace App\Models;

class DetalleVenta extends Modelo
{
    protected $table = 'detalles_venta';
    protected $casts = ['precio_unitario' => 'float'];
}
