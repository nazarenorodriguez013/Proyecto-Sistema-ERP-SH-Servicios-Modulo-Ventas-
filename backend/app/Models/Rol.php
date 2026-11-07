<?php

namespace App\Models;

class Rol extends Modelo
{
    protected $table = 'roles';
    protected $casts = ['es_sistema' => 'boolean', 'activo' => 'boolean', 'creado_en' => 'datetime'];

    public function permisos()
    {
        return $this->hasMany(RolPermiso::class, 'rol_id');
    }

    public function usuarios()
    {
        return $this->hasMany(Usuario::class, 'rol_id');
    }
}
