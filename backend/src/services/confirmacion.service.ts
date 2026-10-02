import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/http';
import { enviarMail } from './mail.service';

const prisma = new PrismaClient();

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const VALIDEZ_MS = 72 * 60 * 60 * 1000;

// Deja al usuario sin confirmar y le manda el link; hasta que lo use no puede iniciar sesión
export const enviarConfirmacion = async (usuario: { id: number; nombre: string; correo: string }, urlBase: string) => {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { correoConfirmado: false, confirmTokenHash: hashToken(token), confirmExpira: new Date(Date.now() + VALIDEZ_MS) },
  });
  await enviarMail(
    usuario.correo, 'Confirmá tu correo - SH Servicios',
    `Hola ${usuario.nombre},\n\nSe creó tu usuario en el sistema de SH Servicios. Para poder entrar confirmá tu correo con este link (vale 3 días):\n${urlBase}/?confirmar=${token}\n\nSi no esperabas este mensaje, ignoralo.`,
  ).catch((err) => console.error('No se pudo enviar el mail de confirmación:', err));
};

export const reenviarConfirmacion = async (id: number, urlBase: string) => {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw httpError(404, 'Usuario no encontrado');
  if (usuario.correoConfirmado) throw httpError(400, 'El correo de este usuario ya está confirmado');
  await enviarConfirmacion(usuario, urlBase);
};

export const confirmar = async (token: string) => {
  const usuario = await prisma.usuario.findFirst({ where: { confirmTokenHash: hashToken(String(token ?? '')), confirmExpira: { gt: new Date() } } });
  if (!usuario) throw httpError(400, 'El link no es válido o ya venció. Pedile al administrador que te reenvíe la confirmación');
  await prisma.usuario.update({ where: { id: usuario.id }, data: { correoConfirmado: true, confirmTokenHash: null, confirmExpira: null } });
};
