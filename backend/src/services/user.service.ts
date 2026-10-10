import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';
import { httpError } from '../utils/http';
import { getIO } from '../socket';
import { SLUG_ADMIN } from '../utils/permisos';

const prisma = new PrismaClient();

// Nunca se devuelve la contraseña ni el token de recuperación
const campos = {
  id: true, nombre: true, correo: true, activo: true, telefono: true, puesto: true,
  rolId: true, rol: { select: { id: true, nombre: true, slug: true } },
  ultimoAcceso: true, ultimaIp: true, bloqueadoHasta: true, dosPasos: true, debeCambiarContrasena: true, creadoEn: true,
} as const;

export const validarContrasena = (contrasena: unknown) => {
  if (typeof contrasena !== 'string' || contrasena.length < 8 || !/[A-ZÁÉÍÓÚÑ]/.test(contrasena) || !/[0-9]/.test(contrasena))
    throw httpError(400, 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
  return contrasena;
};

export const normalizarCorreo = (correo: unknown) => {
  const c = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw httpError(400, 'El correo no es válido');
  return c;
};

const textoOpcional = (v: unknown, max: number) => {
  const t = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return t || null;
};

const traducirError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw httpError(400, 'Ya existe un usuario con ese correo');
    if (err.code === 'P2025') throw httpError(404, 'Usuario no encontrado');
  }
  throw err;
};

type Actor = { id: number; rolSlug: string };

// Solo un administrador puede dar el rol Administrador o modificar a otro administrador:
// así nadie con permiso de usuarios puede darse acceso total a sí mismo
const validarRol = async (rolId: unknown, actor: Actor) => {
  const rol = await prisma.rol.findUnique({ where: { id: Number(rolId) || 0 } });
  if (!rol) throw httpError(400, 'El rol no es válido');
  if (rol.slug === SLUG_ADMIN && actor.rolSlug !== SLUG_ADMIN) throw httpError(403, 'Solo un administrador puede asignar el rol Administrador');
  return rol;
};

export const getAll = () => prisma.usuario.findMany({ select: campos, orderBy: { nombre: 'asc' } });
export const obtener = (id: number) => prisma.usuario.findUnique({ where: { id }, select: campos });

export const create = async (data: Record<string, unknown>, actor: Actor) => {
  if (typeof data.nombre !== 'string' || !data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
  const rol = await validarRol(data.rolId, actor);
  return prisma.usuario.create({
    data: {
      nombre: data.nombre.trim().slice(0, 120), correo: normalizarCorreo(data.correo), rolId: rol.id,
      contrasena: await bcrypt.hash(validarContrasena(data.contrasena), 10),
      telefono: textoOpcional(data.telefono, 40), puesto: textoOpcional(data.puesto, 120),
      activo: data.activo !== false, debeCambiarContrasena: data.debeCambiarContrasena === true,
    },
    select: campos,
  }).catch(traducirError);
};

// Siempre tiene que quedar al menos un administrador activo, si no nadie podría volver a gestionar usuarios
const quedaOtroAdmin = async (excluirId: number) =>
  (await prisma.usuario.count({ where: { rol: { slug: SLUG_ADMIN }, activo: true, id: { not: excluirId } } })) > 0;

export const update = async (id: number, actor: Actor, data: Record<string, unknown>) => {
  const actual = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
  if (!actual) throw httpError(404, 'Usuario no encontrado');
  if (actual.rol.slug === SLUG_ADMIN && actor.rolSlug !== SLUG_ADMIN) throw httpError(403, 'Solo un administrador puede modificar a otro administrador');

  const rol = data.rolId !== undefined && Number(data.rolId) !== actual.rolId ? await validarRol(data.rolId, actor) : actual.rol;
  const activo = data.activo !== undefined ? !!data.activo : actual.activo;
  if (actual.rol.slug === SLUG_ADMIN && actual.activo && (rol.slug !== SLUG_ADMIN || !activo) && !(await quedaOtroAdmin(id)))
    throw httpError(400, 'Tiene que quedar al menos un administrador activo');
  if (id === actor.id && !activo) throw httpError(400, 'No podés desactivar tu propio usuario');

  const cambios: Prisma.UsuarioUncheckedUpdateInput = { rolId: rol.id, activo };
  // El administrador solo puede apagarla (por ejemplo si perdieron el acceso al mail); activarla lo decide cada usuario
  if (data.dosPasos === false) cambios.dosPasos = false;
  if (data.nombre !== undefined) {
    if (typeof data.nombre !== 'string' || !data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
    cambios.nombre = data.nombre.trim().slice(0, 120);
  }
  if (data.correo !== undefined) cambios.correo = normalizarCorreo(data.correo);
  if (data.telefono !== undefined) cambios.telefono = textoOpcional(data.telefono, 40);
  if (data.puesto !== undefined) cambios.puesto = textoOpcional(data.puesto, 120);
  if (data.debeCambiarContrasena !== undefined) cambios.debeCambiarContrasena = data.debeCambiarContrasena === true;
  if (data.contrasena) cambios.contrasena = await bcrypt.hash(validarContrasena(data.contrasena), 10);
  // "Desbloquear intentos fallidos": vuelve a dejarlo entrar sin esperar
  if (data.desbloquear === true) Object.assign(cambios, { intentosFallidos: 0, bloqueosSeguidos: 0, bloqueadoHasta: null });

  const usuario = await prisma.usuario.update({ where: { id }, data: cambios, select: campos }).catch(traducirError);
  getIO()?.emit('permisos-actualizados');
  return usuario;
};

// Eliminar definitivamente (desactivar es un update con activo = false)
export const remove = async (id: number, actor: Actor) => {
  if (id === actor.id) throw httpError(400, 'No podés eliminar tu propio usuario');
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true, _count: { select: { ventas: true, serviciosAsignados: true } } } });
  if (!usuario) throw httpError(404, 'Usuario no encontrado');
  if (usuario.rol.slug === SLUG_ADMIN && actor.rolSlug !== SLUG_ADMIN) throw httpError(403, 'Solo un administrador puede eliminar a otro administrador');
  if (usuario.rol.slug === SLUG_ADMIN && usuario.activo && !(await quedaOtroAdmin(id))) throw httpError(400, 'Tiene que quedar al menos un administrador activo');
  if (usuario._count.ventas || usuario._count.serviciosAsignados)
    throw httpError(409, 'No se puede eliminar: tiene ventas o servicios registrados. Desactivalo en su lugar');
  await prisma.usuario.delete({ where: { id } });
  return usuario;
};
