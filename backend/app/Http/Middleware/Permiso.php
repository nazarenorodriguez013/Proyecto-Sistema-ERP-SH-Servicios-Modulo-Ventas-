<?php

namespace App\Http\Middleware;

use App\Support\Erp;
use Closure;
use Illuminate\Http\Request;

// Deja pasar si el usuario tiene alguno de los permisos; si no, responde 403 y lo deja en la auditoría
class Permiso
{
    public function handle(Request $r, Closure $next, string ...$permisos)
    {
        $actor = $r->attributes->get('usuario');
        if (! array_intersect($permisos, $actor->permisos ?? [])) {
            Erp::auditar($r, ['accion' => 'access_denied', 'seccion' => 'seguridad', 'descripcion' => 'Acceso denegado a '.$r->method().' /'.$r->path()]);

            return response()->json(['message' => 'No tenés permiso para esta acción'], 403);
        }

        return $next($r);
    }
}
