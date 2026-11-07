<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

// Orden de preferencia: Resend (API web), SMTP (el correo de Hostinger), o solo el log del servidor
class Correo
{
    public static function enviar(string $para, string $asunto, string $texto): bool
    {
        // Solo para las pruebas automáticas: anota el mail en un archivo en vez de mandarlo
        if (($archivo = config('erp.mails_log')) && ! app()->isProduction()) {
            file_put_contents($archivo, json_encode(['to' => [$para], 'subject' => $asunto, 'text' => $texto])."\n", FILE_APPEND | LOCK_EX);

            return true;
        }

        if ($clave = config('erp.resend_key')) {
            $res = Http::withToken($clave)->post('https://api.resend.com/emails', [
                'from' => config('erp.mail_from'), 'to' => [$para], 'subject' => $asunto, 'text' => $texto,
            ]);
            if (! $res->successful()) {
                throw new RuntimeException('Resend respondió '.$res->status());
            }

            return true;
        }

        if (config('mail.default') === 'smtp' && config('mail.mailers.smtp.host')) {
            Mail::raw($texto, fn ($m) => $m->to($para)->subject($asunto));

            return true;
        }

        // Sin proveedor configurado el mail no sale: queda en el log para pasárselo al usuario a mano
        Log::info("[mail sin proveedor configurado] Para: $para\nAsunto: $asunto\n$texto");

        return false;
    }
}
