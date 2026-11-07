<?php

namespace App\Http\Controllers;

use App\Support\ErrorHttp;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;

abstract class Controller
{
    // El usuario que hace el pedido (lo cuelga el middleware Autenticar)
    protected function actor(Request $r): object
    {
        return $r->attributes->get('usuario');
    }

    protected function falla(int $status, string $mensaje): never
    {
        throw new ErrorHttp($status, $mensaje);
    }

    protected static function texto($valor): string
    {
        return is_scalar($valor) ? (string) $valor : '';
    }

    // Los datos llegan en JSON: un número viene como número o como texto numérico; cualquier otra cosa es NAN
    protected static function numero($valor): float
    {
        if ($valor === null || $valor === '') {
            return 0.0;
        }

        return is_numeric($valor) ? (float) $valor : NAN;
    }

    protected static function entero($valor): bool
    {
        return is_int($valor) || (is_float($valor) && is_finite($valor) && floor($valor) === $valor);
    }

    protected static function id($valor): int
    {
        return is_numeric($valor) ? (int) $valor : 0;
    }

    protected static function textoOpcional($valor, int $max = 0): ?string
    {
        $t = is_string($valor) ? trim($valor) : '';
        if ($max) {
            $t = mb_substr($t, 0, $max);
        }

        return $t !== '' ? $t : null;
    }

    protected static function esDuplicado(QueryException $e): bool
    {
        return ($e->errorInfo[1] ?? null) === 1062;
    }

    protected static function like(string $texto): string
    {
        return '%'.addcslashes($texto, '%_\\').'%';
    }
}
