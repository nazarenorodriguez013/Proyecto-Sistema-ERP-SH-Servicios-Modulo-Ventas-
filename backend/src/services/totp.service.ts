import crypto from 'crypto';
import QRCode from 'qrcode';

// Códigos de Google Authenticator (TOTP, RFC 6238): 6 dígitos que cambian cada 30 segundos,
// calculados con un secreto que comparten el servidor y la app del celular
const PERIODO_S = 30;
const DIGITOS = 6;
// Se acepta el código anterior y el siguiente por si el reloj del celular está un poco corrido
const TOLERANCIA = 1;
const EMISOR = 'SH Servicios';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const aBase32 = (buf: Buffer) => {
  let bits = '', texto = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) texto += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return texto;
};

const deBase32 = (texto: string) => {
  let bits = '';
  for (const c of texto.replace(/=+$/, '').toUpperCase()) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error('Secreto inválido');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

// 20 bytes al azar (160 bits), lo que recomienda la RFC; en base32 son 32 letras para cargar a mano si no se puede escanear
export const generarSecreto = () => aBase32(crypto.randomBytes(20));

const pasoActual = () => Math.floor(Date.now() / 1000 / PERIODO_S);

const codigoDelPaso = (secreto: string, paso: number) => {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = crypto.createHmac('sha1', deBase32(secreto)).update(contador).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const numero = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITOS;
  return String(numero).padStart(DIGITOS, '0');
};

// Devuelve el intervalo al que corresponde el código (para no aceptarlo dos veces) o null si no es válido
export const verificar = (secreto: string, codigo: string, ultimoPasoUsado?: number | null): number | null => {
  const limpio = String(codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;
  const ahora = pasoActual();
  for (let d = -TOLERANCIA; d <= TOLERANCIA; d++) {
    const paso = ahora + d;
    if (ultimoPasoUsado != null && paso <= ultimoPasoUsado) continue;
    if (crypto.timingSafeEqual(Buffer.from(codigoDelPaso(secreto, paso)), Buffer.from(limpio))) return paso;
  }
  return null;
};

// Lo que lee la app al escanear el QR: emisor, cuenta (el correo) y el secreto
export const urlOtpauth = (secreto: string, correo: string) =>
  `otpauth://totp/${encodeURIComponent(`${EMISOR}:${correo}`)}?secret=${secreto}&issuer=${encodeURIComponent(EMISOR)}&algorithm=SHA1&digits=${DIGITOS}&period=${PERIODO_S}`;

export const qr = (secreto: string, correo: string) => QRCode.toDataURL(urlOtpauth(secreto, correo), { margin: 1, width: 220 });

// El secreto se guarda cifrado (AES-256-GCM con una clave derivada de JWT_SECRET): quien lea la base no puede generar códigos
const clave = () => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:totp`).digest();

export const cifrar = (secreto: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cipher.update(secreto, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), datos].map(b => b.toString('base64')).join('.');
};

export const descifrar = (guardado: string) => {
  const [iv, tag, datos] = guardado.split('.').map(p => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
};
