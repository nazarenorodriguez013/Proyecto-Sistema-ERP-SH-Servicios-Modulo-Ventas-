import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/http';
import { enviarMail } from './mail.service';

const prisma = new PrismaClient();

const VALIDEZ_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;
const MAX_INTENTOS = 5;

export type Proposito = 'login' | 'activar';

// Solo se guarda un hash con el usuario y el servidor como sal: un código de 6 dígitos sin eso se adivinaría al instante
const hashCodigo = (usuarioId: number, codigo: string) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(`${usuarioId}:${codigo}`).digest('hex');

// Genera un código de 6 dígitos, lo guarda hasheado (vale 10 minutos) y se lo manda por mail
export const enviarCodigo = async (usuario: { id: number; nombre: string; correo: string; codigoExpira: Date | null }, proposito: Proposito) => {
  if (usuario.codigoExpira && Date.now() - (usuario.codigoExpira.getTime() - VALIDEZ_MS) < ESPERA_REENVIO_MS)
    throw httpError(429, 'Esperá un minuto antes de pedir otro código');

  const codigo = String(crypto.randomInt(100000, 1000000));
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { codigoHash: hashCodigo(usuario.id, codigo), codigoExpira: new Date(Date.now() + VALIDEZ_MS), codigoIntentos: 0, codigoProposito: proposito },
  });
  const enviado = await enviarMail(
    usuario.correo, `Tu código de verificación: ${codigo}`,
    `Hola ${usuario.nombre},\n\nTu código para ${proposito === 'login' ? 'iniciar sesión en' : 'activar la verificación en dos pasos de'} SH Servicios es:\n\n${codigo}\n\nVale 10 minutos. Si no fuiste vos, cambiá tu contraseña.`,
  ).catch((err) => { console.error('No se pudo enviar el código:', err); return false; });
  // Para activar hace falta que el mail llegue de verdad, si no el usuario podría quedar sin poder entrar
  if (!enviado && proposito === 'activar') throw httpError(503, 'No se pudo enviar el mail. Avisale al administrador para que revise la configuración de correo');
};

export const verificarCodigo = async (usuarioId: number, codigo: string, proposito: Proposito) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario?.codigoHash || !usuario.codigoExpira || usuario.codigoExpira < new Date() || usuario.codigoProposito !== proposito)
    throw httpError(400, 'El código venció o no se pidió. Pedí uno nuevo');
  if (usuario.codigoIntentos >= MAX_INTENTOS) throw httpError(429, 'Demasiados intentos. Pedí un código nuevo');

  const esperado = Buffer.from(usuario.codigoHash, 'hex');
  const recibido = Buffer.from(hashCodigo(usuarioId, String(codigo ?? '').trim()), 'hex');
  if (!crypto.timingSafeEqual(esperado, recibido)) {
    await prisma.usuario.update({ where: { id: usuarioId }, data: { codigoIntentos: { increment: 1 } } });
    throw httpError(400, 'Código incorrecto');
  }
  // Un código sirve una sola vez
  await prisma.usuario.update({ where: { id: usuarioId }, data: { codigoHash: null, codigoExpira: null, codigoIntentos: 0, codigoProposito: null } });
  return usuario;
};
