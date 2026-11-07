<?php

namespace App\Models;

class Categoria extends Modelo
{
    protected $table = 'categorias';
    protected $casts = ['creado_en' => 'datetime'];

    public function productos()
    {
        return $this->hasMany(Producto::class, 'categoria_id');
    }
}
