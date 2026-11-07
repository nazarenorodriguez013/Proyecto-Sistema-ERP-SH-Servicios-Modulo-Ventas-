<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

// Base de todos los modelos: la base usa snake_case y la API responde en camelCase con fechas ISO en UTC,
// el mismo formato que espera el frontend
abstract class Modelo extends Model
{
    public $timestamps = false;
    public static $snakeAttributes = false;
    protected $guarded = [];
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected function serializeDate(DateTimeInterface $fecha): string
    {
        return Carbon::instance($fecha)->utc()->format('Y-m-d\TH:i:s.v\Z');
    }

    public function attributesToArray()
    {
        $salida = [];
        foreach (parent::attributesToArray() as $clave => $valor) {
            $salida[Str::camel($clave)] = $valor;
        }

        return $salida;
    }
}
