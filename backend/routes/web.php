<?php

use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok']));

// Un archivo de /assets que ya no existe (pestaña abierta durante un deploy) tiene que dar 404: si se respondiera
// con el HTML, el navegador intentaría ejecutarlo como JavaScript y la pantalla quedaría en negro
Route::get('assets/{archivo}', fn () => abort(404))->where('archivo', '.*');

// El resto es la aplicación React (build copiado a public/). El HTML nunca se cachea, así el navegador
// toma siempre los archivos nuevos tras actualizar el sistema
Route::fallback(function () {
    $app = public_path('app.html');
    abort_unless(is_file($app), 404);

    return response()->file($app, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache']);
});
