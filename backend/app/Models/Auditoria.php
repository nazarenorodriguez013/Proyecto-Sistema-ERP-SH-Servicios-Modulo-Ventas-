<?php

namespace App\Models;

class Auditoria extends Modelo
{
    protected $table = 'auditoria';
    protected $casts = ['datos' => 'array', 'creado_en' => 'datetime'];
}
