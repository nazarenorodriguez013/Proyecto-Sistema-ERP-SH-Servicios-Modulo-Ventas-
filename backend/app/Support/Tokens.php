<?php

namespace App\Support;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// La sesión y el desafío de dos pasos son JWT firmados con claves distintas, así uno no sirve por el otro
class Tokens
{
    private static function clave(string $uso): string
    {
        return hash('sha256', config('erp.jwt_secret').':'.$uso);
    }

    public static function sesion(int $id): string
    {
        return JWT::encode(['id' => $id, 'iat' => time(), 'exp' => time() + 8 * 3600], self::clave('sesion'), 'HS256');
    }

    public static function leerSesion(string $token): int
    {
        return (int) JWT::decode($token, new Key(self::clave('sesion'), 'HS256'))->id;
    }

    public static function desafio(int $id): string
    {
        return JWT::encode(['uid' => $id, 'iat' => time(), 'exp' => time() + 600], self::clave('2fa'), 'HS256');
    }

    public static function leerDesafio(string $token): int
    {
        return (int) JWT::decode($token, new Key(self::clave('2fa'), 'HS256'))->uid;
    }
}
