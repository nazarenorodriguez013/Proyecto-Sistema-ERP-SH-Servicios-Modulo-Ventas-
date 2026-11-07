<?php

namespace App\Support;

// Reglas de contraseñas y correos, compartidas por Mi cuenta, Usuarios y Técnicos
class Credenciales
{
    public static function validarContrasena($contrasena): string
    {
        if (! is_string($contrasena) || mb_strlen($contrasena) < 8 || ! preg_match('/[A-ZÁÉÍÓÚÑ]/u', $contrasena) || ! preg_match('/[0-9]/', $contrasena)) {
            throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
        }

        return $contrasena;
    }

    public static function normalizarCorreo($correo): string
    {
        $c = is_string($correo) ? mb_strtolower(trim($correo)) : '';
        if (! preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $c)) {
            throw new ErrorHttp(400, 'El correo no es válido');
        }

        return $c;
    }

    public static function hash(string $contrasena): string
    {
        return password_hash($contrasena, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    // Las contraseñas del sistema anterior están en bcrypt con prefijo $2b$, que es el mismo algoritmo que $2y$
    public static function verificar($contrasena, string $hash): bool
    {
        if (str_starts_with($hash, '$2b$')) {
            $hash = '$2y$'.substr($hash, 4);
        }

        return is_string($contrasena) && password_verify($contrasena, $hash);
    }
}
