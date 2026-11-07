<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDO;

// Copia los datos del sistema anterior (PostgreSQL) a MySQL, conservando ids, contraseñas y secretos.
// Se corre una sola vez desde una PC que llegue a las dos bases:
//   php -d extension=pdo_pgsql artisan erp:migrar-postgres "pgsql:host=localhost;port=5432;dbname=sh_servicios" postgres clave
class MigrarPostgres extends Command
{
    protected $signature = 'erp:migrar-postgres {dsn} {usuario} {clave?}';
    protected $description = 'Copia todos los datos de PostgreSQL a la base MySQL (la deja igual al origen)';

    // En orden de dependencias
    private const TABLAS = ['roles', 'rol_permisos', 'usuarios', 'auditoria', 'categorias', 'productos', 'correlativos', 'clientes', 'ventas', 'detalles_venta',
        'servicios_tecnicos', 'servicio_repuestos', 'movimientos_cuenta', 'empresa', 'notificaciones'];

    public function handle(): int
    {
        $origen = new PDO($this->argument('dsn'), $this->argument('usuario'), (string) $this->argument('clave'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $origen->exec("SET TIME ZONE 'UTC'");

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (array_reverse(self::TABLAS) as $tabla) {
            DB::table($tabla)->delete();
        }
        foreach (self::TABLAS as $tabla) {
            $total = 0;
            $lote = [];
            foreach ($origen->query("SELECT * FROM \"$tabla\"", PDO::FETCH_ASSOC) as $fila) {
                $lote[] = $this->adaptar($tabla, $fila);
                if (count($lote) === 200) {
                    DB::table($tabla)->insert($lote);
                    $total += 200;
                    $lote = [];
                }
            }
            if ($lote) {
                DB::table($tabla)->insert($lote);
                $total += count($lote);
            }
            $this->line(str_pad($tabla, 22).$total);
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $this->info('Listo');

        return self::SUCCESS;
    }

    private function adaptar(string $tabla, array $fila): array
    {
        if ($tabla === 'servicios_tecnicos') {
            $fila['finalizado_en'] = $fila['entregado_en'];
            unset($fila['entregado_en']);
        }
        foreach ($fila as $clave => $valor) {
            // PostgreSQL entrega los booleanos como true/false y las fechas con hasta 6 decimales
            if (is_bool($valor)) {
                $fila[$clave] = (int) $valor;
            } elseif (is_string($valor) && preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(\.\d+)?(\+00(:00)?)?$/', $valor, $m)) {
                $fila[$clave] = $m[1].substr(($m[2] ?? '.000').'000', 0, 4);
            }
        }

        return $fila;
    }
}
