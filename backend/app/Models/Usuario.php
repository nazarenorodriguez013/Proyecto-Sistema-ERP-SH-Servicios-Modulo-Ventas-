<?php

namespace App\Models;

use App\Support\Permisos;

class Usuario extends Modelo
{
    protected $table = 'usuarios';

    // Nada de esto sale nunca por la API, ni siquiera dentro de una venta o un servicio
    protected $hidden = [
        'contrasena', 'codigo_hash', 'codigo_expira', 'codigo_intentos', 'codigo_proposito', 'totp_secreto', 'totp_pendiente',
        'totp_ultimo_paso', 'reset_token_hash', 'reset_expira', 'intentos_fallidos', 'bloqueos_seguidos', 'notif_vistas_hasta',
    ];

    protected $casts = [
        'activo' => 'boolean', 'debe_cambiar_contrasena' => 'boolean', 'dos_pasos' => 'boolean',
        'ultimo_acceso' => 'datetime', 'bloqueado_hasta' => 'datetime', 'codigo_expira' => 'datetime', 'reset_expira' => 'datetime',
        'notif_vistas_hasta' => 'datetime', 'creado_en' => 'datetime', 'actualizado_en' => 'datetime',
    ];

    public function rol()
    {
        return $this->belongsTo(Rol::class, 'rol_id');
    }

    public function ventas()
    {
        return $this->hasMany(Venta::class, 'usuario_id');
    }

    public function serviciosAsignados()
    {
        return $this->hasMany(ServicioTecnico::class, 'tecnico_id');
    }

    // Técnico = usuario cuyo rol tiene explícitamente "servicios.tecnico". El Administrador tiene todo pero no cuenta como técnico
    public function scopeTecnicos($consulta)
    {
        return $consulta->whereHas('rol', fn ($q) => $q->where('slug', '!=', Permisos::SLUG_ADMIN)->where('activo', true)
            ->whereHas('permisos', fn ($p) => $p->where('permiso', 'servicios.tecnico')));
    }
}
