<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogoController;
use App\Http\Controllers\ClienteController;
use App\Http\Controllers\GestionController;
use App\Http\Controllers\ImportacionController;
use App\Http\Controllers\SeguridadController;
use App\Http\Controllers\ServicioController;
use App\Http\Controllers\VentaController;
use Illuminate\Support\Facades\Route;

// Sin sesión: son el punto de entrada. Los usuarios los crea el administrador, no hay registro público
Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::post('login', 'login');
    Route::get('config', 'config');
    Route::post('google', 'loginGoogle');
    Route::post('forgot', 'olvideContrasena');
    Route::post('reset', 'restablecerContrasena');
    Route::post('2fa', 'verificarDosPasos');
    Route::post('2fa/reenviar', 'reenviarCodigo');
});

Route::middleware('autenticar')->group(function () {
    Route::prefix('auth')->controller(AuthController::class)->group(function () {
        Route::post('2fa/activar', 'solicitarActivacion');
        Route::post('2fa/activar/confirmar', 'confirmarActivacion');
        Route::post('2fa/app', 'iniciarApp');
        Route::post('2fa/app/confirmar', 'confirmarApp');
        Route::post('2fa/desactivar', 'desactivarDosPasos');
        Route::get('me', 'sesionActual');
        Route::put('me', 'actualizarCuenta');
    });

    // Las pantallas abiertas consultan acá si hubo cambios (reemplaza a Socket.io)
    Route::get('eventos', [GestionController::class, 'eventos']);

    Route::controller(CatalogoController::class)->group(function () {
        Route::get('categories', 'categorias')->middleware('permiso:productos.ver,productos.editar,categorias.gestionar,datos.exportar');
        Route::middleware('permiso:categorias.gestionar')->group(function () {
            Route::post('categories', 'crearCategoria');
            Route::put('categories/{id}', 'editarCategoria');
            Route::delete('categories/{id}', 'eliminarCategoria');
        });

        // Ver artículos hace falta para el catálogo, pero también para vender y para cargar repuestos o prepararlos en el depósito
        Route::middleware('permiso:productos.ver,productos.editar,ventas.crear,servicios.gestionar,servicios.repuestos,retiros.gestionar')->group(function () {
            Route::get('products', 'productos');
            Route::get('products/low-stock', 'stockBajo');
            Route::get('products/{id}', 'producto');
        });
        Route::middleware('permiso:productos.editar')->group(function () {
            Route::post('products', 'crearProducto');
            Route::put('products/{id}', 'editarProducto');
            Route::delete('products/{id}', 'eliminarProducto');
        });
    });

    Route::controller(VentaController::class)->group(function () {
        Route::get('sales', 'index')->middleware('permiso:ventas.ver');
        Route::post('sales', 'store')->middleware('permiso:ventas.crear');
        Route::delete('sales/{id}', 'destroy')->middleware('permiso:ventas.anular');
    });

    Route::controller(ClienteController::class)->group(function () {
        // El listado también lo necesitan quienes eligen un cliente al vender o al registrar un servicio
        Route::get('clients', 'index')->middleware('permiso:clientes.gestionar,ventas.crear,servicios.gestionar');
        Route::middleware('permiso:clientes.gestionar')->group(function () {
            Route::get('clients/{id}', 'show');
            Route::post('clients', 'store');
            Route::put('clients/{id}', 'update');
            Route::post('clients/{id}/movements', 'registrarPago');
        });
        Route::middleware('permiso:clientes.eliminar')->group(function () {
            Route::delete('clients/{id}', 'destroy');
            Route::delete('clients/{id}/movements/{movimientoId}', 'eliminarMovimiento');
        });
        Route::get('audit/pagos-eliminados', 'pagosEliminados')->middleware('permiso:auditoria.ver');
    });

    Route::controller(ServicioController::class)->group(function () {
        // La cola de retiros la maneja el depósito y la ve también administración
        Route::middleware('permiso:retiros.gestionar')->group(function () {
            Route::get('repairs/retiros', 'retiros');
            Route::put('repairs/retiros/{id}', 'marcarRetiro');
        });
        Route::middleware('permiso:servicios.gestionar')->group(function () {
            Route::post('repairs', 'store');
            Route::post('repairs/presupuesto', 'presupuesto');
            Route::put('repairs/{id}/tecnico', 'asignarTecnico');
        });
        // El rol Inventario no ve los servicios, solo su cola de retiros
        Route::middleware('permiso:servicios.gestionar,servicios.tecnico')->group(function () {
            Route::get('repairs', 'index');
            Route::get('repairs/{id}', 'show');
            Route::put('repairs/{id}', 'actualizar');
            Route::put('repairs/{id}/finalizar', 'finalizar');
        });
        Route::middleware('permiso:servicios.repuestos')->group(function () {
            Route::post('repairs/{id}/repuestos', 'agregarRepuesto');
            Route::delete('repairs/{id}/repuestos/{productoId}', 'quitarRepuesto');
        });
        Route::delete('repairs/{id}', 'destroy')->middleware('permiso:servicios.eliminar');
    });

    Route::controller(SeguridadController::class)->group(function () {
        Route::get('technicians', 'tecnicos')->middleware('permiso:tecnicos.ver,servicios.gestionar');
        Route::middleware('permiso:tecnicos.gestionar')->group(function () {
            Route::post('technicians', 'crearTecnico');
            Route::put('technicians/{id}', 'editarTecnico');
            Route::delete('technicians/{id}', 'eliminarTecnico');
        });

        Route::get('users', 'usuarios')->middleware('permiso:usuarios.ver,usuarios.gestionar');
        Route::middleware('permiso:usuarios.gestionar')->group(function () {
            Route::post('users', 'crearUsuario');
            Route::put('users/{id}', 'editarUsuario');
            Route::delete('users/{id}', 'eliminarUsuario');
        });

        // La pantalla de Usuarios también necesita la lista de roles
        Route::get('roles', 'roles')->middleware('permiso:roles.gestionar,usuarios.ver,usuarios.gestionar');
        Route::middleware('permiso:roles.gestionar')->group(function () {
            Route::get('roles/permisos', 'catalogoPermisos');
            Route::get('roles/{id}', 'rol');
            Route::post('roles', 'crearRol');
            Route::put('roles/{id}', 'editarRol');
            Route::delete('roles/{id}', 'eliminarRol');
        });

        Route::get('audit', 'auditoria')->middleware('permiso:auditoria.ver');
    });

    Route::controller(GestionController::class)->group(function () {
        // Cualquier usuario logueado necesita los datos para imprimir comprobantes
        Route::get('company', 'empresa');
        Route::put('company', 'editarEmpresa')->middleware('permiso:configuracion.gestionar');
        Route::get('notifications', 'notificaciones');
        Route::put('notifications/leidas', 'marcarLeidas');
        Route::get('export/{dataset}', 'exportar')->middleware('permiso:datos.exportar');
    });

    Route::middleware('permiso:datos.importar')->controller(ImportacionController::class)->group(function () {
        Route::post('import/preview', 'previsualizar');
        Route::post('import/run', 'importar');
    });

    // Cualquier otra ruta de usuarios o roles pide sesión antes de responder que no existe
    Route::any('{seccion}/{resto?}', fn () => abort(404))->where(['seccion' => 'users|roles', 'resto' => '.*']);
});
