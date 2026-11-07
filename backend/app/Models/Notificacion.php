<?php

namespace App\Models;

class Notificacion extends Modelo
{
    protected $table = 'notificaciones';
    protected $casts = ['creado_en' => 'datetime'];
}
