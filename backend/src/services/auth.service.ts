import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient, Usuario } from '@prisma/client';
import { httpError } from '../utils/http';
import { enviarMail } from './mail.service';
import { enviarCodigo, verificarCodigo } from './dospasos.service';
import { normalizarCorreo, validarContrasena } from './user.service';
import { permisosDeRol } from '../utils/permisos';

const prisma = new PrismaClient();

// La sesión lleva el rol y sus permisos: el frontend arma el menú con eso (la API los vuelve a validar en cada pedido)
const emitirSesion = async (id: number) => {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id }, include: { rol: { include: { permisos: true } } } });
  return {
    token: jwt.sign({ id: u.id }, process.env.JWT_SECRET as string, { expiresIn: '8h' }),
    user: {
      id: u.id, nombre: u.nombre, correo: u.correo, dosPasos: u.dosPasos, debeCambiarContrasena: u.debeCambiarContrasena,
      rol: { id: u.rol.id, nombre: u.rol.nombre, slug: u.rol.slug }, permisos: permisosDeRol(u.rol),
    },
  };
};

// Datos actuales del usuario (rol y permisos tal como están ahora en la base): el frontend los pide para que un cambio de rol se vea sin volver a iniciar sesión
export const sesionActual = async (id: number) => (await emitirSesion(id)).user;

// Ingreso completo (con o sin segundo paso): se registra cuándo y desde dónde, y se olvidan los intentos fallidos
const iniciarSesion = async (id: number, ip: string | null) => {
  await prisma.usuario.update({
    where: { id },
    data: { ultimoAcceso: new Date(), ultimaIp: ip, intentosFallidos: 0, bloqueosSeguidos: 0, bloqueadoHasta: null },
  });
  return emitirSesion(id);
};

const buscarPorCorreo = (correo: string) =>
  prisma.usuario.findFirst({ where: { correo: { equals: correo.trim(), mode: 'insensitive' } } });

// Bloqueo por contraseñas incorrectas, como en el catálogo: cada tanda de 5 intentos fallidos bloquea la cuenta
// y si se sigue insistiendo el bloqueo escala (5 min, 15 min, 1 h y después 6 h)
const INTENTOS_POR_TANDA = 5;
const BLOQUEOS_MIN = [5, 15, 60, 360];

const verificarBloqueo = (usuario: Usuario) => {
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    const min = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000);
    throw httpError(429, `La cuenta está bloqueada por intentos fallidos. Probá de nuevo en ${min} minuto${min === 1 ? '' : 's'} o pedile al administrador que la desbloquee`);
  }
};

const registrarFallo = async (usuario: Usuario) => {
  const intentos = usuario.intentosFallidos + 1;
  if (intentos < INTENTOS_POR_TANDA) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: intentos } });
    return;
  }
  const minutos = BLOQUEOS_MIN[Math.min(usuario.bloqueosSeguidos, BLOQUEOS_MIN.length - 1)];
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueosSeguidos: usuario.bloqueosSeguidos + 1, bloqueadoHasta: new Date(Date.now() + minutos * 60_000) },
  });
};

// Mismo mensaje de error tanto si el correo no existe como si la contraseña es incorrecta,
// para no revelar a un atacante cuál de los dos datos está mal
export const login = async (correo: string, contrasena: string, ip: string | null) => {
  const usuario = await buscarPorCorreo(String(correo ?? ''));
  if (usuario) verificarBloqueo(usuario);
  if (!usuario || !(await bcrypt.compare(String(contrasena ?? ''), usuario.contrasena))) {
    if (usuario) await registrarFallo(usuario);
    throw httpError(401, 'Credenciales inválidas');
  }
  if (!usuario.activo) throw httpError(401, 'Tu usuario está desactivado. Consultá con el administrador');
  return pedirSegundoPaso(usuario, ip);
};

// Con verificación en dos pasos, ni la contraseña ni Google alcanzan solos: falta el código que llega por mail
const pedirSegundoPaso = async (usuario: Usuario, ip: string | null) => {
  if (!usuario.dosPasos) return iniciarSesion(usuario.id, ip);
  // Si ya se mandó un código hace menos de un minuto (por ejemplo al probar con contraseña y enseguida con Google)
  // ese sigue vigente: se muestra igual la pantalla del código en vez de un error
  await enviarCodigo(usuario, 'login').catch((err) => { if (err.status !== 429) throw err; });
  return { requiere2fa: true, desafio: emitirDesafio(usuario.id), correo: enmascarar(usuario.correo) };
};

// El desafío identifica a quien ya pasó la contraseña; usa otra clave para que no sirva como token de sesión
const emitirDesafio = (id: number) => jwt.sign({ uid: id }, `${process.env.JWT_SECRET}:2fa`, { expiresIn: '10m' });
const leerDesafio = (desafio: string): number => {
  try { return (jwt.verify(String(desafio ?? ''), `${process.env.JWT_SECRET}:2fa`) as { uid: number }).uid; }
  catch { throw httpError(401, 'La verificación venció. Iniciá sesión de nuevo'); }
};
const enmascarar = (correo: string) => correo.replace(/^(.).*(@.*)$/, '$1***$2');

export const verificarDosPasos = async (desafio: string, codigo: string, ip: string | null) => {
  const usuario = await verificarCodigo(leerDesafio(desafio), codigo, 'login');
  if (!usuario.activo) throw httpError(401, 'Tu usuario está desactivado. Consultá con el administrador');
  return iniciarSesion(usuario.id, ip);
};

export const reenviarCodigo = async (desafio: string) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: leerDesafio(desafio) } });
  if (!usuario?.activo || !usuario.dosPasos) throw httpError(401, 'La verificación venció. Iniciá sesión de nuevo');
  await enviarCodigo(usuario, 'login');
};

// Cada usuario decide si la activa: para prenderla tiene que probar que recibe los mails con un código
export const solicitarActivacion = async (id: number) => {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  if (usuario.dosPasos) throw httpError(400, 'La verificación en dos pasos ya está activada');
  await enviarCodigo(usuario, 'activar');
};

export const confirmarActivacion = async (id: number, codigo: string) => {
  await verificarCodigo(id, codigo, 'activar');
  await prisma.usuario.update({ where: { id }, data: { dosPasos: true } });
  return emitirSesion(id);
};

export const desactivarDosPasos = async (id: number, contrasenaActual: string) => {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  if (!(await bcrypt.compare(String(contrasenaActual ?? ''), usuario.contrasena))) throw httpError(400, 'La contraseña actual no es correcta');
  await prisma.usuario.update({ where: { id }, data: { dosPasos: false, codigoHash: null, codigoExpira: null, codigoProposito: null } });
  return emitirSesion(id);
};

// Client ID de Google (se crea en Google Cloud Console); sin él el botón no se muestra
export const config = () => ({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });

// Solo entran con Google quienes ya tienen usuario creado por el administrador: el correo de Google tiene que coincidir
export const loginGoogle = async (credential: string, ip: string | null) => {
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
  verificarBloqueo(usuario);
  return pedirSegundoPaso(usuario, ip);
};

// Cambio de datos propios: para cambiar correo o contraseña hay que confirmar la contraseña actual
export const actualizarCuenta = async (id: number, data: { nombre?: string; correo?: string; contrasenaActual?: string; contrasenaNueva?: string }) => {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw httpError(404, 'Usuario no encontrado');

  const cambios: { nombre?: string; correo?: string; contrasena?: string; debeCambiarContrasena?: boolean } = {};
  if (data.nombre !== undefined) {
    if (!data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
    cambios.nombre = data.nombre.trim();
  }
  const correo = data.correo !== undefined ? normalizarCorreo(data.correo) : undefined;
  if (correo && correo !== usuario.correo) cambios.correo = correo;
  if (data.contrasenaNueva) {
    cambios.contrasena = await bcrypt.hash(validarContrasena(data.contrasenaNueva), 10);
    // Si el administrador le pidió cambiarla, con esto ya cumplió
    cambios.debeCambiarContrasena = false;
  }

  if ((cambios.correo || cambios.contrasena) && !(await bcrypt.compare(String(data.contrasenaActual ?? ''), usuario.contrasena)))
    throw httpError(400, 'La contraseña actual no es correcta');

  await prisma.usuario.update({ where: { id }, data: cambios }).catch((err) => {
    if (err?.code === 'P2002') throw httpError(400, 'Ya existe un usuario con ese correo');
    throw err;
  });
  return emitirSesion(id);
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
    data: { contrasena: await bcrypt.hash(contrasena, 10), resetTokenHash: null, resetExpira: null },
  });
};
