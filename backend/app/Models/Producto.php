<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;

class Producto extends Modelo
{
    protected $table = 'productos';
    protected $casts = [
        'precio_costo' => 'float', 'precio' => 'float', 'activo' => 'boolean',
        'creado_en' => 'datetime', 'actualizado_en' => 'datetime',
    ];

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    // Siguiente número para un código automático. Solo cuentan los códigos numéricos: los que vienen del
    // catálogo (por ejemplo "AE-0113") conviven sin romper la numeración
    public static function siguienteCodigo(): int
    {
        return (int) DB::table('productos')->whereRaw("codigo REGEXP '^[0-9]+$'")->max(DB::raw('CAST(codigo AS UNSIGNED)')) + 1;
    }

    // Lo pedido por servicios técnicos y todavía no retirado del depósito
    public static function reservado(int $id): int
    {
        return (int) ServicioRepuesto::where('producto_id', $id)->sum(DB::raw('cantidad - cantidad_retirada'));
    }
}
