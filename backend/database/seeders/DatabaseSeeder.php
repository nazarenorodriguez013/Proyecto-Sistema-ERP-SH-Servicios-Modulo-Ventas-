<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\Rol;
use App\Models\Usuario;
use App\Support\Credenciales;
use Illuminate\Database\Seeder;

// Usuarios y catálogo de prueba, solo para desarrollo: php artisan db:seed.
// En producción no se usa: el primer administrador se crea con php artisan erp:crear-admin
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([['Administrador', 'admin@shservicios.com', 'admin123', 'admin'], ['Vendedor', 'vendedor@shservicios.com', 'vendedor123', 'vendedor'], ['Técnico', 'tecnico@shservicios.com', 'tecnico123', 'tecnico']] as [$nombre, $correo, $clave, $slug]) {
            Usuario::firstOrCreate(['correo' => $correo], ['nombre' => $nombre, 'contrasena' => Credenciales::hash($clave), 'rol_id' => Rol::where('slug', $slug)->value('id')]);
        }

        if (Categoria::exists()) {
            return;
        }
        $id = [];
        foreach ([['Elevadores y Levanta Autos', 'MAQUINARIA'], ['Equipos de Taller', 'MAQUINARIA'], ['Herramientas Neumaticas', 'REPUESTO'], ['Accesorios de Elevación', 'REPUESTO']] as [$nombre, $tipo]) {
            $id[] = Categoria::create(['nombre' => $nombre, 'tipo' => $tipo])->id;
        }
        $filas = [
            ['0002', 'MAQUINARIA', 'Elevador Columna 2 Postes 4000 kg', 849400, 620000, 1, 1, true, 0],
            ['0003', 'MAQUINARIA', 'Elevador 4 Columnas 5000 kg', 1290000, 980000, 193, 1, false, 0],
            ['0004', 'REPUESTO', 'Gato Hidraulico de Piso 3 Ton', 52000, 38000, 99, 3, true, 3],
            ['0005', 'REPUESTO', 'Caballete Mecanico 3 Ton (par)', 21000, 14500, 20, 4, true, 3],
            ['0006', 'MAQUINARIA', 'Compresor de Aire 100L 3 HP', 128000, 95000, 5, 2, true, 1],
            ['0007', 'MAQUINARIA', 'Balanceadora de Ruedas Digital', 560000, 420000, 0, 1, true, 1],
            ['0008', 'MAQUINARIA', 'Alineadora 3D Laser 4 Ruedas', 1650000, 1250000, 1, 1, true, 1],
            ['0009', 'REPUESTO', 'Pistola de Impacto Neumatica 1/2"', 31500, 22000, 12, 3, true, 2],
            ['0010', 'REPUESTO', 'Kit Inflador Digital de Neumaticos', 13500, 8500, 21, 5, true, 2],
        ];
        foreach ($filas as [$codigo, $tipo, $nombre, $precio, $costo, $stock, $minimo, $activo, $cat]) {
            Producto::create(['codigo' => $codigo, 'tipo_producto' => $tipo, 'nombre' => $nombre, 'precio' => $precio, 'precio_costo' => $costo, 'stock' => $stock, 'stock_minimo' => $minimo, 'activo' => $activo, 'categoria_id' => $id[$cat]]);
        }
    }
}
