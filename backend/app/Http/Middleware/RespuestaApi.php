<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use stdClass;

// Lo común a toda la API: límite de tamaño, JSON mal formado y sin caché
class RespuestaApi
{
    private const LIMITE = 102400;
    private const LIMITE_IMPORTACION = 8 * 1024 * 1024; // el CSV viaja dentro del JSON

    public function handle(Request $r, Closure $next)
    {
        $cuerpo = $r->getContent();
        if (strlen($cuerpo) > ($r->is('api/import/*') ? self::LIMITE_IMPORTACION : self::LIMITE)) {
            return response()->json(['message' => 'El pedido es demasiado grande'], 413);
        }
        if ($cuerpo !== '' && $r->isJson()) {
            json_decode($cuerpo);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json(['message' => 'El cuerpo del pedido no es un JSON válido'], 400);
            }
        }

        $respuesta = $next($r);

        if ($respuesta instanceof JsonResponse && str_contains((string) $respuesta->getContent(), 'nombreProducto')) {
            $respuesta->setData(self::conTextoDelArticulo($respuesta->getData()));
        }
        // Los permisos y el stock tienen que ser siempre los actuales
        $respuesta->headers->set('Cache-Control', 'no-store');

        return $respuesta;
    }

    // Los comprobantes guardan el artículo como texto (nombre y código al momento de la operación): se arma el mismo
    // formato de siempre (producto.nombre / producto.codigo) para que la hoja salga igual aunque el artículo cambie o se elimine
    private static function conTextoDelArticulo($valor)
    {
        if (is_array($valor)) {
            return array_map(self::conTextoDelArticulo(...), $valor);
        }
        if ($valor instanceof stdClass) {
            foreach (get_object_vars($valor) as $clave => $dato) {
                $valor->$clave = self::conTextoDelArticulo($dato);
            }
            if (is_string($valor->nombreProducto ?? null) && property_exists($valor, 'productoId')) {
                $valor->producto = (object) array_merge((array) ($valor->producto ?? []), [
                    'id' => $valor->productoId, 'nombre' => $valor->nombreProducto, 'codigo' => $valor->codigoProducto ?? null,
                ]);
            }
        }

        return $valor;
    }
}
