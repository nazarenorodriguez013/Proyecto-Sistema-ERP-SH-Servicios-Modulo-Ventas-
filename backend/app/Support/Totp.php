<?php

namespace App\Support;

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

// Códigos de Google Authenticator (TOTP, RFC 6238): 6 dígitos que cambian cada 30 segundos
class Totp
{
    private const PERIODO = 30;
    private const TOLERANCIA = 1; // se acepta el anterior y el siguiente por si el reloj del celular está corrido
    private const EMISOR = 'SH Servicios';
    private const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generarSecreto(): string
    {
        $bits = '';
        foreach (str_split(random_bytes(20)) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }
        $texto = '';
        foreach (str_split($bits, 5) as $grupo) {
            $texto .= self::BASE32[bindec(str_pad($grupo, 5, '0'))];
        }

        return $texto;
    }

    private static function deBase32(string $texto): string
    {
        $bits = '';
        foreach (str_split(strtoupper(rtrim($texto, '='))) as $c) {
            $bits .= str_pad(decbin(strpos(self::BASE32, $c)), 5, '0', STR_PAD_LEFT);
        }
        $bytes = '';
        for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
            $bytes .= chr(bindec(substr($bits, $i, 8)));
        }

        return $bytes;
    }

    private static function codigoDelPaso(string $secreto, int $paso): string
    {
        $hmac = hash_hmac('sha1', pack('J', $paso), self::deBase32($secreto), true);
        $offset = ord($hmac[19]) & 0xF;
        $numero = (unpack('N', substr($hmac, $offset, 4))[1] & 0x7FFFFFFF) % 1000000;

        return str_pad((string) $numero, 6, '0', STR_PAD_LEFT);
    }

    // Devuelve el intervalo del código (para no aceptarlo dos veces) o null si no es válido
    public static function verificar(string $secreto, $codigo, ?int $ultimoPaso = null): ?int
    {
        $limpio = preg_replace('/\s/', '', (string) ($codigo ?? ''));
        if (! preg_match('/^\d{6}$/', $limpio)) {
            return null;
        }
        $ahora = intdiv(time(), self::PERIODO);
        for ($d = -self::TOLERANCIA; $d <= self::TOLERANCIA; $d++) {
            $paso = $ahora + $d;
            if ($ultimoPaso !== null && $paso <= $ultimoPaso) {
                continue;
            }
            if (hash_equals(self::codigoDelPaso($secreto, $paso), $limpio)) {
                return $paso;
            }
        }

        return null;
    }

    public static function urlOtpauth(string $secreto, string $correo): string
    {
        return 'otpauth://totp/'.rawurlencode(self::EMISOR.':'.$correo).'?secret='.$secreto.'&issuer='.rawurlencode(self::EMISOR).'&algorithm=SHA1&digits=6&period='.self::PERIODO;
    }

    // Imagen del QR como data URL (SVG: no necesita extensiones de imágenes en el hosting)
    public static function qr(string $secreto, string $correo): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(220, 1), new SvgImageBackEnd));

        return 'data:image/svg+xml;base64,'.base64_encode($writer->writeString(self::urlOtpauth($secreto, $correo)));
    }

    // El secreto se guarda cifrado (AES-256-GCM, mismo formato que el sistema anterior): quien lea la base no puede generar códigos
    private static function clave(): string
    {
        return hash('sha256', config('erp.jwt_secret').':totp', true);
    }

    public static function cifrar(string $secreto): string
    {
        $iv = random_bytes(12);
        $datos = openssl_encrypt($secreto, 'aes-256-gcm', self::clave(), OPENSSL_RAW_DATA, $iv, $tag);

        return implode('.', array_map('base64_encode', [$iv, $tag, $datos]));
    }

    public static function descifrar(string $guardado): string
    {
        [$iv, $tag, $datos] = array_map('base64_decode', explode('.', $guardado));

        return openssl_decrypt($datos, 'aes-256-gcm', self::clave(), OPENSSL_RAW_DATA, $iv, $tag);
    }
}
