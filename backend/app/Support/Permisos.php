<?php

namespace App\Support;

// Permisos del sistema, agrupados por módulo. Los roles guardan qué permisos tienen (tabla rol_permisos);
// el rol Administrador (slug "admin") los tiene siempre todos.
class Permisos
{
    public const SLUG_ADMIN = 'admin';

    public const MODULOS = [
        ['modulo' => 'catalogo', 'nombre' => 'Catálogo', 'permisos' => [
            ['clave' => 'productos.ver', 'nombre' => 'Ver maquinaria y repuestos'],
            ['clave' => 'productos.editar', 'nombre' => 'Crear, editar y eliminar maquinaria y repuestos'],
            ['clave' => 'productos.costos', 'nombre' => 'Ver costos y ganancias'],
            ['clave' => 'categorias.gestionar', 'nombre' => 'Administrar categorías'],
        ]],
        ['modulo' => 'ventas', 'nombre' => 'Ventas y clientes', 'permisos' => [
            ['clave' => 'ventas.crear', 'nombre' => 'Registrar ventas (Punto de Venta)'],
            ['clave' => 'ventas.ver', 'nombre' => 'Ver el historial de ventas'],
            ['clave' => 'ventas.anular', 'nombre' => 'Anular ventas'],
            ['clave' => 'clientes.gestionar', 'nombre' => 'Ver, crear y editar clientes y registrar pagos'],
            ['clave' => 'clientes.eliminar', 'nombre' => 'Eliminar clientes y movimientos de cuenta corriente'],
        ]],
        ['modulo' => 'servicios', 'nombre' => 'Servicio técnico', 'permisos' => [
            ['clave' => 'servicios.gestionar', 'nombre' => 'Gestionar todos los servicios (registrar, asignar, finalizar e historial)'],
            ['clave' => 'servicios.tecnico', 'nombre' => 'Trabajar como técnico (se le pueden asignar servicios y ve los suyos)'],
            ['clave' => 'servicios.repuestos', 'nombre' => 'Cargar y quitar repuestos de un servicio'],
            ['clave' => 'servicios.eliminar', 'nombre' => 'Eliminar servicios'],
            ['clave' => 'tecnicos.ver', 'nombre' => 'Ver técnicos'],
            ['clave' => 'tecnicos.gestionar', 'nombre' => 'Crear, editar y eliminar técnicos'],
            ['clave' => 'retiros.gestionar', 'nombre' => 'Preparar y entregar retiros de repuestos'],
        ]],
        ['modulo' => 'gestion', 'nombre' => 'Gestión', 'permisos' => [
            ['clave' => 'datos.importar', 'nombre' => 'Importar datos'],
            ['clave' => 'datos.exportar', 'nombre' => 'Exportar datos'],
            ['clave' => 'configuracion.gestionar', 'nombre' => 'Editar la configuración (datos de la empresa)'],
        ]],
        ['modulo' => 'seguridad', 'nombre' => 'Seguridad', 'permisos' => [
            ['clave' => 'usuarios.ver', 'nombre' => 'Ver usuarios'],
            ['clave' => 'usuarios.gestionar', 'nombre' => 'Crear, editar, desactivar y eliminar usuarios'],
            ['clave' => 'roles.gestionar', 'nombre' => 'Administrar roles y permisos'],
            ['clave' => 'auditoria.ver', 'nombre' => 'Ver el registro de auditoría'],
        ]],
    ];

    public static function todos(): array
    {
        return array_merge(...array_map(fn ($m) => array_column($m['permisos'], 'clave'), self::MODULOS));
    }

    // Permisos efectivos de un rol: el Administrador todos; un rol desactivado, ninguno
    public static function deRol($rol): array
    {
        if ($rol->slug === self::SLUG_ADMIN) {
            return self::todos();
        }
        if (! $rol->activo) {
            return [];
        }

        return array_values(array_intersect($rol->permisos->pluck('permiso')->all(), self::todos()));
    }

    // Solo se guardan claves conocidas y sin repetir
    public static function normalizar($permisos): array
    {
        return is_array($permisos)
            ? array_values(array_unique(array_filter($permisos, fn ($p) => is_string($p) && in_array($p, self::todos(), true))))
            : [];
    }
}
