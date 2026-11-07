<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Esquema completo del ERP en MySQL/MariaDB (equivalente a backend/prisma/schema.prisma).
// Las fechas se guardan en UTC. Los nombres que deben distinguir acentos (categorías, códigos) usan collation binaria.
return new class extends Migration
{
    public function up(): void
    {
        $fecha = fn (Blueprint $t, string $c) => $t->dateTime($c, 3)->nullable();
        $ahora = fn (Blueprint $t, string $c) => $t->dateTime($c, 3)->useCurrent();

        Schema::create('roles', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->string('nombre', 120)->unique();
            $t->string('slug', 120)->unique();
            $t->string('descripcion', 255)->nullable();
            $t->boolean('es_sistema')->default(false);
            $t->boolean('activo')->default(true);
            $ahora($t, 'creado_en');
        });

        Schema::create('rol_permisos', function (Blueprint $t) {
            $t->unsignedInteger('rol_id');
            $t->string('permiso', 60);
            $t->primary(['rol_id', 'permiso']);
            $t->foreign('rol_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        Schema::create('usuarios', function (Blueprint $t) use ($fecha, $ahora) {
            $t->increments('id');
            $t->string('nombre', 120);
            $t->string('correo', 160)->unique();
            $t->string('contrasena', 255);
            $t->unsignedInteger('rol_id');
            $t->boolean('activo')->default(true);
            $t->string('telefono', 40)->nullable();
            $t->string('puesto', 120)->nullable();
            $t->boolean('debe_cambiar_contrasena')->default(false);
            $fecha($t, 'ultimo_acceso');
            $t->string('ultima_ip', 60)->nullable();
            $t->integer('intentos_fallidos')->default(0);
            $t->integer('bloqueos_seguidos')->default(0);
            $fecha($t, 'bloqueado_hasta');
            $t->boolean('dos_pasos')->default(false);
            $t->string('codigo_hash', 128)->nullable();
            $fecha($t, 'codigo_expira');
            $t->integer('codigo_intentos')->default(0);
            $t->string('codigo_proposito', 20)->nullable();
            $t->string('totp_secreto', 255)->nullable();
            $t->string('totp_pendiente', 255)->nullable();
            $t->bigInteger('totp_ultimo_paso')->nullable();
            $t->string('reset_token_hash', 128)->nullable();
            $fecha($t, 'reset_expira');
            $ahora($t, 'notif_vistas_hasta');
            $ahora($t, 'creado_en');
            $t->dateTime('actualizado_en', 3)->useCurrent()->useCurrentOnUpdate();
            $t->foreign('rol_id')->references('id')->on('roles');
        });

        Schema::create('auditoria', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->unsignedInteger('usuario_id')->nullable();
            $t->string('usuario_nombre', 120)->nullable();
            $t->string('accion', 60);
            $t->string('seccion', 60);
            $t->string('entidad', 60)->nullable();
            $t->unsignedInteger('entidad_id')->nullable();
            $t->string('descripcion', 255);
            $t->json('datos')->nullable();
            $t->string('ip', 60)->nullable();
            $t->string('user_agent', 255)->nullable();
            $ahora($t, 'creado_en');
            $t->index('creado_en');
        });

        Schema::create('categorias', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->string('nombre', 191)->collation('utf8mb4_bin')->unique();
            $t->string('tipo', 20)->default('REPUESTO');
            $ahora($t, 'creado_en');
        });

        Schema::create('productos', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->string('codigo', 60)->collation('utf8mb4_bin')->nullable()->unique();
            $t->string('nombre', 255);
            $t->text('descripcion')->nullable();
            $t->string('tipo_producto', 20)->default('REPUESTO');
            $t->double('precio_costo')->default(0);
            $t->double('precio');
            $t->integer('stock')->default(0);
            $t->integer('stock_minimo')->default(5);
            $t->boolean('activo')->default(true);
            $t->unsignedInteger('categoria_id');
            $ahora($t, 'creado_en');
            $t->dateTime('actualizado_en', 3)->useCurrent()->useCurrentOnUpdate();
            $t->foreign('categoria_id')->references('id')->on('categorias');
        });

        Schema::create('correlativos', function (Blueprint $t) {
            $t->string('tipo', 30)->primary();
            $t->integer('ultimo_numero')->default(0);
        });

        Schema::create('clientes', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->string('nombre', 255);
            $t->string('documento', 60)->nullable()->unique();
            $t->string('telefono', 60)->nullable();
            $t->string('email', 190)->nullable();
            $t->string('direccion', 255)->nullable();
            $t->string('condicion_iva', 60)->default('Consumidor Final');
            $ahora($t, 'creado_en');
            $t->dateTime('actualizado_en', 3)->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('ventas', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->integer('numero');
            $t->double('total');
            $t->string('tipo_comprobante', 20)->default('FACTURA');
            $t->string('medio_pago', 60)->default('Efectivo');
            $t->double('monto_recibido')->nullable();
            $t->double('saldo_aplicado')->default(0);
            $t->double('saldo_cliente')->nullable();
            $t->unsignedInteger('usuario_id');
            $t->unsignedInteger('cliente_id')->nullable();
            $ahora($t, 'creado_en');
            $t->foreign('usuario_id')->references('id')->on('usuarios');
            $t->foreign('cliente_id')->references('id')->on('clientes');
        });

        Schema::create('detalles_venta', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('venta_id');
            $t->unsignedInteger('producto_id')->nullable();
            $t->integer('cantidad');
            $t->double('precio_unitario');
            $t->string('nombre_producto', 255)->default('');
            $t->string('codigo_producto', 60)->nullable();
            $t->foreign('venta_id')->references('id')->on('ventas');
            $t->foreign('producto_id')->references('id')->on('productos')->nullOnDelete();
        });

        Schema::create('servicios_tecnicos', function (Blueprint $t) use ($fecha, $ahora) {
            $t->increments('id');
            $t->unsignedInteger('cliente_id');
            $t->unsignedInteger('tecnico_id')->nullable();
            $t->string('equipo', 255);
            $t->text('descripcion_falla');
            $t->text('tareas')->nullable();
            $t->text('diagnostico')->nullable();
            $t->text('trabajo_realizado')->nullable();
            $t->boolean('en_garantia')->default(false);
            $t->double('costo_mano_obra')->default(0);
            $t->string('estado', 20)->default('EN_CURSO');
            $fecha($t, 'fecha_estimada_fin');
            $t->string('tipo_comprobante', 20)->nullable();
            $t->integer('numero')->nullable();
            $t->string('medio_pago', 60)->nullable();
            $t->double('total')->nullable();
            $t->double('saldo_aplicado')->default(0);
            $t->double('saldo_cliente')->nullable();
            $fecha($t, 'proximo_mantenimiento');
            $t->string('codigo_retiro', 30)->nullable()->unique();
            $t->string('estado_retiro', 20)->nullable();
            $fecha($t, 'listo_en');
            $fecha($t, 'retirado_en');
            $ahora($t, 'fecha_ingreso');
            $fecha($t, 'finalizado_en');
            $t->foreign('cliente_id')->references('id')->on('clientes');
            $t->foreign('tecnico_id')->references('id')->on('usuarios');
        });

        Schema::create('servicio_repuestos', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('servicio_id');
            $t->unsignedInteger('producto_id')->nullable();
            $t->string('nombre_producto', 255)->default('');
            $t->string('codigo_producto', 60)->nullable();
            $t->integer('cantidad');
            $t->integer('cantidad_retirada')->default(0);
            $t->double('precio_unitario');
            $t->unique(['servicio_id', 'producto_id']);
            $t->foreign('servicio_id')->references('id')->on('servicios_tecnicos');
            $t->foreign('producto_id')->references('id')->on('productos')->nullOnDelete();
        });

        Schema::create('movimientos_cuenta', function (Blueprint $t) use ($fecha, $ahora) {
            $t->increments('id');
            $t->unsignedInteger('cliente_id');
            $t->string('tipo', 20);
            $t->string('concepto', 255);
            $t->double('monto');
            $t->unsignedInteger('venta_id')->nullable();
            $t->unsignedInteger('servicio_id')->nullable();
            $ahora($t, 'creado_en');
            $t->unsignedInteger('registrado_por_id')->nullable();
            $t->string('registrado_por_nombre', 120)->nullable();
            $fecha($t, 'eliminado_en');
            $t->unsignedInteger('eliminado_por_id')->nullable();
            $t->string('eliminado_por_nombre', 120)->nullable();
            $t->string('motivo_eliminacion', 255)->nullable();
            $t->index(['cliente_id', 'eliminado_en']);
            $t->foreign('cliente_id')->references('id')->on('clientes');
            $t->foreign('venta_id')->references('id')->on('ventas');
            $t->foreign('servicio_id')->references('id')->on('servicios_tecnicos');
        });

        Schema::create('empresa', function (Blueprint $t) {
            $t->unsignedInteger('id')->primary();
            foreach (['razon_social', 'rubro', 'domicilio', 'condicion_iva', 'telefono', 'email', 'cuit', 'ingresos_brutos', 'inicio_actividades'] as $c) {
                $t->string($c, 255)->default('');
            }
            $t->integer('punto_venta')->default(1);
        });

        Schema::create('notificaciones', function (Blueprint $t) use ($ahora) {
            $t->increments('id');
            $t->string('area', 20);
            $t->unsignedInteger('usuario_id')->nullable();
            $t->string('titulo', 255);
            $t->text('mensaje');
            $t->unsignedInteger('servicio_id')->nullable();
            $ahora($t, 'creado_en');
            $t->index(['area', 'creado_en']);
        });

        // Reemplaza a Socket.io: cada evento lleva un contador y las pantallas consultan si cambió
        Schema::create('eventos', function (Blueprint $t) {
            $t->string('nombre', 60)->primary();
            $t->unsignedBigInteger('version')->default(0);
        });

        DB::table('empresa')->insert(['id' => 1, 'razon_social' => 'SH Servicios', 'rubro' => 'Insumos y Soluciones Técnicas']);

        // Roles de sistema con los mismos permisos que en el sistema anterior
        $roles = [
            ['Administrador', 'admin', 'Acceso total al sistema', []],
            ['Vendedor', 'vendedor', 'Punto de venta, clientes, cobros y circuito de servicio técnico',
                ['clientes.gestionar', 'datos.exportar', 'productos.costos', 'productos.ver', 'retiros.gestionar', 'servicios.gestionar', 'tecnicos.ver', 'ventas.crear', 'ventas.ver']],
            ['Técnico', 'tecnico', 'Ve sus servicios asignados, carga repuestos y los finaliza', ['servicios.repuestos', 'servicios.tecnico']],
            ['Inventario', 'inventario', 'Depósito: maquinaria, repuestos, categorías, stock y retiros de repuestos',
                ['categorias.gestionar', 'datos.exportar', 'datos.importar', 'productos.costos', 'productos.editar', 'productos.ver', 'retiros.gestionar']],
        ];
        foreach ($roles as [$nombre, $slug, $descripcion, $permisos]) {
            $id = DB::table('roles')->insertGetId(['nombre' => $nombre, 'slug' => $slug, 'descripcion' => $descripcion, 'es_sistema' => true]);
            foreach ($permisos as $permiso) {
                DB::table('rol_permisos')->insert(['rol_id' => $id, 'permiso' => $permiso]);
            }
        }
    }

    public function down(): void
    {
        foreach (['eventos', 'notificaciones', 'empresa', 'movimientos_cuenta', 'servicio_repuestos', 'servicios_tecnicos', 'detalles_venta', 'ventas', 'clientes', 'correlativos', 'productos', 'categorias', 'auditoria', 'usuarios', 'rol_permisos', 'roles'] as $tabla) {
            Schema::dropIfExists($tabla);
        }
    }
};
