<?php

use App\Http\Middleware\Autenticar;
use App\Http\Middleware\Permiso;
use App\Http\Middleware\RespuestaApi;
use App\Support\ErrorHttp;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // La API recibe los datos tal cual: las contraseñas no se recortan ni los textos vacíos pasan a null
        $middleware->remove([TrimStrings::class, ConvertEmptyStringsToNull::class]);
        // La sesión es por token: las páginas no necesitan cookies ni sesión de PHP
        $middleware->web(remove: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
        ]);
        $middleware->api(prepend: [RespuestaApi::class]);
        $middleware->alias(['autenticar' => Autenticar::class, 'permiso' => Permiso::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->dontReport([ErrorHttp::class]);

        // La API siempre responde JSON con un mensaje pensado para el usuario. Un error interno se registra en el log
        // y se responde algo genérico, para no filtrar detalles de la base
        $exceptions->render(function (Throwable $e, Request $r) {
            if (! $r->is('api/*')) {
                return null;
            }
            if ($e instanceof ErrorHttp) {
                return response()->json(['message' => $e->getMessage()], $e->status);
            }
            if ($e instanceof NotFoundHttpException || $e instanceof MethodNotAllowedHttpException || $e instanceof ModelNotFoundException) {
                return response()->json(['message' => 'No encontrado'], 404);
            }
            if ($e instanceof PostTooLargeException) {
                return response()->json(['message' => 'El pedido es demasiado grande'], 413);
            }
            Log::error('Error interno: '.$e->getMessage(), ['ruta' => $r->method().' '.$r->path(), 'en' => $e->getFile().':'.$e->getLine()]);

            return response()->json(['message' => 'Los datos enviados no son válidos'], 400);
        });
    })->create();
