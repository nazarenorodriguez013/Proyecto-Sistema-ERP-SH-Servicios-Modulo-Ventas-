<?php

namespace App\Models;

class ServicioTecnico extends Modelo
{
    protected $table = 'servicios_tecnicos';
    protected $casts = [
        'en_garantia' => 'boolean', 'costo_mano_obra' => 'float', 'total' => 'float', 'saldo_aplicado' => 'float', 'saldo_cliente' => 'float',
        'fecha_estimada_fin' => 'datetime', 'proximo_mantenimiento' => 'datetime', 'listo_en' => 'datetime', 'retirado_en' => 'datetime',
        'fecha_ingreso' => 'datetime', 'finalizado_en' => 'datetime',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function tecnico()
    {
        return $this->belongsTo(Usuario::class, 'tecnico_id');
    }

    public function repuestos()
    {
        return $this->hasMany(ServicioRepuesto::class, 'servicio_id');
    }
}
