<?php

namespace App\Http\Middleware;

use App\Models\Usuario;
use App\Support\Permisos;
use App\Support\Tokens;
use Closure;
use Illuminate\Http\Request;
use Throwable;

// Valida el token "Authorization: Bearer <token>". El token solo identifica a la persona: si la desactivaron o la
// borraron la sesión deja de servir en el acto, y los permisos son siempre los del rol actual
class Autenticar
{
    public function handle(Request $r, Closure $next)
    {
        $token = $r->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'Token requerido'], 401);
        }
        try {
            $id = Tokens::leerSesion($token);
        } catch (Throwable) {
            return response()->json(['message' => 'Token inválido'], 401);
        }

        $usuario = Usuario::with('rol.permisos')->find($id);
        if (! $usuario?->activo) {
            return response()->json(['message' => 'Sesión inválida. Volvé a iniciar sesión'], 401);
        }

        $r->attributes->set('usuario', (object) [
            'id' => $usuario->id, 'correo' => $usuario->correo, 'nombre' => $usuario->nombre,
            'rolSlug' => $usuario->rol->slug, 'permisos' => Permisos::deRol($usuario->rol),
        ]);

        return $next($r);
    }
}
