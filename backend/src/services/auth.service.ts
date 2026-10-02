import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient, Usuario } from '@prisma/client';
import { httpError } from '../utils/http';
import { enviarMail } from './mail.service';
import { enviarConfirmacion, confirmar } from './confirmacion.service';
import { normalizarCorreo, validarContrasena } from './user.service';

const prisma = new PrismaClient();

const datosUsuario = (u: Usuario) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, modulos: u.modulos });

const emitirSesion = (u: Usuario) => ({
  token: jwt.sign({ id: u.id, correo: u.correo, rol: u.rol }, process.env.JWT_SECRET as string, { expiresIn: '8h' }),
  user: datosUsuario(u),
});

const buscarPorCorreo = (correo: string) =>
  prisma.usuario.findFirst({ where: { correo: { equals: correo.trim(), mode: 'insensitive' } } });

// Mismo mensaje de error tanto si el correo no existe como si la contraseña es incorrecta,
// para no revelar a un atacante cuál de los dos datos está mal
export const login = async (correo: string, contrasena: string) => {
  const usuario = await buscarPorCorreo(String(correo ?? ''));
  if (!usuario || !(await bcrypt.compare(String(contrasena ?? ''), usuario.contrasena))) throw httpError(401, 'Credenciales inválidas');
  if (!usuario.activo) throw httpError(401, 'Tu usuario está desactivado. Consultá con el administrador');
  if (!usuario.correoConfirmado) throw httpError(403, 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada (y spam) o pedile al administrador que te reenvíe el link');
  return emitirSesion(usuario);
};

export const confirmarCorreo = (token: string) => confirmar(token);

// Client ID de Google (se crea en Google Cloud Console); sin él el botón no se muestra
export const config = () => ({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });

// Solo entran con Google quienes ya tienen usuario creado por el administrador: el correo de Google tiene que coincidir
export const loginGoogle = async (credential: string) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw httpError(503, 'El inicio de sesión con Google no está configurado');
  let correo: string | undefined;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: String(credential ?? ''), audience: clientId });
    const payload = ticket.getPayload();
    if (payload?.email_verified) correo = payload.email;
  } catch {
    throw httpError(401, 'No se pudo validar la cuenta de Google');
  }
  if (!correo) throw httpError(401, 'La cuenta de Google no tiene un correo verificado');
  const usuario = await buscarPorCorreo(correo);
  if (!usuario) throw httpError(403, 'Esa cuenta de Google no tiene acceso. Pedile al administrador que te cree un usuario con ese correo');
  if (!usuario.activo) throw httpError(401, 'Tu usuario está desactivado. Consultá con el administrador');
  // Google ya verificó que el correo es de quien entra, así que cuenta como confirmado
  if (!usuario.correoConfirmado) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { correoConfirmado: true, confirmTokenHash: null, confirmExpira: null } });
  }
  return emitirSesion(usuario);
};

// Cambio de datos propios: para cambiar correo o contraseña hay que confirmar la contraseña actual
export const actualizarCuenta = async (id: number, urlBase: string, data: { nombre?: string; correo?: string; contrasenaActual?: string; contrasenaNueva?: string }) => {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw httpError(404, 'Usuario no encontrado');

  const cambios: { nombre?: string; correo?: string; contrasena?: string } = {};
  if (data.nombre !== undefined) {
    if (!data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
    cambios.nombre = data.nombre.trim();
  }
  const correo = data.correo !== undefined ? normalizarCorreo(data.correo) : undefined;
  if (correo && correo !== usuario.correo) cambios.correo = correo;
  if (data.contrasenaNueva) cambios.contrasena = await bcrypt.hash(validarContrasena(data.contrasenaNueva), 10);

  if ((cambios.correo || cambios.contrasena) && !(await bcrypt.compare(String(data.contrasenaActual ?? ''), usuario.contrasena)))
    throw httpError(400, 'La contraseña actual no es correcta');

  const actualizado = await prisma.usuario.update({ where: { id }, data: cambios }).catch((err) => {
    if (err?.code === 'P2002') throw httpError(400, 'Ya existe un usuario con ese correo');
    throw err;
  });
  // Un correo nuevo hay que volver a confirmarlo
  if (cambios.correo) await enviarConfirmacion(actualizado, urlBase);
  return emitirSesion(actualizado);
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const VALIDEZ_TOKEN_MS = 60 * 60 * 1000;
const ultimoPedido = new Map<string, number>();

// Responde siempre lo mismo exista o no el correo, para no revelar qué usuarios hay cargados
export const olvideContrasena = async (correo: string, urlBase: string) => {
  const clave = String(correo ?? '').trim().toLowerCase();
  if (!clave) throw httpError(400, 'Ingresá tu correo');
  // Un pedido por minuto por correo, para que no se use para llenar de mails a alguien
  if (Date.now() - (ultimoPedido.get(clave) ?? 0) < 60_000) return;
  ultimoPedido.set(clave, Date.now());

  const usuario = await buscarPorCorreo(clave);
  if (!usuario?.activo) return;
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.usuario.update({ where: { id: usuario.id }, data: { resetTokenHash: hashToken(token), resetExpira: new Date(Date.now() + VALIDEZ_TOKEN_MS) } });
  await enviarMail(
    usuario.correo, 'Recuperar contraseña - SH Servicios',
    `Hola ${usuario.nombre},\n\nPara elegir una contraseña nueva entrá a este link (vale 1 hora):\n${urlBase}/?reset=${token}\n\nSi no lo pediste vos, ignorá este mensaje.`,
  ).catch((err) => console.error('No se pudo enviar el mail de recuperación:', err));
};

export const restablecerContrasena = async (token: string, contrasena: string) => {
  validarContrasena(contrasena);
  const usuario = await prisma.usuario.findFirst({ where: { resetTokenHash: hashToken(String(token ?? '')), resetExpira: { gt: new Date() } } });
  if (!usuario) throw httpError(400, 'El link no es válido o ya venció. Pedí uno nuevo');
  await prisma.usuario.update({
    where: { id: usuario.id },
    // Entrar por el link del mail también prueba que el correo es suyo
    data: { contrasena: await bcrypt.hash(contrasena, 10), resetTokenHash: null, resetExpira: null, correoConfirmado: true },
  });
};
