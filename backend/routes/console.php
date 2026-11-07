<?php

use App\Models\Rol;
use App\Models\Usuario;
use App\Support\Credenciales;
use Illuminate\Support\Facades\Artisan;

// Primer administrador en un servidor nuevo: php artisan erp:crear-admin "Nombre" correo@empresa.com "Contraseña1"
Artisan::command('erp:crear-admin {nombre} {correo} {contrasena}', function (string $nombre, string $correo, string $contrasena) {
    $u = Usuario::create([
        'nombre' => $nombre, 'correo' => Credenciales::normalizarCorreo($correo),
        'contrasena' => Credenciales::hash(Credenciales::validarContrasena($contrasena)),
        'rol_id' => Rol::where('slug', 'admin')->value('id'), 'debe_cambiar_contrasena' => true,
    ]);
    $this->info("Administrador creado: {$u->correo}");
})->purpose('Crea un usuario administrador');
