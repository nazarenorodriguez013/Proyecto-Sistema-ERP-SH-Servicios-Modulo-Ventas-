<?php

namespace App\Support;

use App\Models\Auditoria;
use App\Models\Notificacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

// Ayudas compartidas: eventos para las pantallas, auditoría, numeración y notificaciones
class Erp
{
    // Reemplaza al emit de Socket.io: sube el contador del evento y las pantallas abiertas lo ven en su próxima consulta
    public static function emitir(string ...$eventos): void
    {
        foreach ($eventos as $evento) {
            DB::statement('INSERT INTO eventos (nombre, version) VALUES (?, 1) ON DUPLICATE KEY UPDATE version = version + 1', [$evento]);
        }
    }

    // Registra quién hizo qué. Nunca rompe la operación principal: si falla, solo queda en el log
    public static function auditar(Request $r, array $e): void
    {
        try {
            $actor = $r->attributes->get('usuario');
            $usuario = array_key_exists('usuario', $e) ? $e['usuario'] : ($actor ? ['id' => $actor->id, 'nombre' => $actor->nombre] : null);
            Auditoria::create([
                'usuario_id' => $usuario['id'] ?? null, 'usuario_nombre' => $usuario['nombre'] ?? null,
                'accion' => mb_substr($e['accion'], 0, 60), 'seccion' => mb_substr($e['seccion'], 0, 60),
                'entidad' => $e['entidad'] ?? null, 'entidad_id' => $e['entidadId'] ?? null,
                'descripcion' => mb_substr($e['descripcion'], 0, 255),
                'datos' => ! empty($e['datos']) ? $e['datos'] : null,
                'ip' => $r->ip(), 'user_agent' => mb_substr((string) $r->userAgent(), 0, 255) ?: null,
            ]);
        } catch (Throwable $err) {
            Log::error('[AUDITORIA] '.$err->getMessage());
        }
    }

    // Compara antes y después y devuelve solo lo que cambió: { campo: { antes, ahora } }
    public static function diferencias(array $antes, array $ahora, array $campos): array
    {
        $cambios = [];
        foreach ($campos as $campo) {
            $a = $antes[$campo] ?? null;
            $b = $ahora[$campo] ?? null;
            if (json_encode($a) !== json_encode($b)) {
                $cambios[$campo] = ['antes' => $a, 'ahora' => $b];
            }
        }

        return $cambios;
    }

    // El registro guarda solo la última semana. Sin procesos permanentes en el hosting, se limpia al entrar, una vez por día
    public static function purgarAuditoria(): void
    {
        if (Cache::add('auditoria-purgada', 1, 86400)) {
            Auditoria::where('creado_en', '<', now()->subDays(7))->delete();
        }
    }

    // Siguiente número de un tipo de comprobante; el INSERT ... UPDATE es atómico, dos comprobantes nunca comparten número
    public static function siguienteNumero(string $tipo): int
    {
        return DB::transaction(function () use ($tipo) {
            DB::statement('INSERT INTO correlativos (tipo, ultimo_numero) VALUES (?, 1) ON DUPLICATE KEY UPDATE ultimo_numero = ultimo_numero + 1', [$tipo]);

            return (int) DB::table('correlativos')->where('tipo', $tipo)->value('ultimo_numero');
        });
    }

    public static function notificar(array $datos): void
    {
        Notificacion::create($datos + ['usuario_id' => null]);
        self::emitir('notificaciones-actualizadas');
    }

    public static function pesos($n): string
    {
        return '$'.rtrim(rtrim(number_format((float) $n, 2, ',', '.'), '0'), ',');
    }
}
