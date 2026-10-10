import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';
import { httpError } from '../utils/http';
import { SLUG_ADMIN } from '../utils/permisos';
import { validarContrasena } from './user.service';

const prisma = new PrismaClient();

// Técnico = usuario cuyo rol tiene explícitamente el permiso "servicios.tecnico" (el rol Técnico de sistema
// o cualquier rol personalizado que lo incluya). El Administrador tiene todos los permisos pero no cuenta como técnico.
export const filtroTecnicos: Prisma.UsuarioWhereInput = {
  rol: { slug: { not: SLUG_ADMIN }, activo: true, permisos: { some: { permiso: 'servicios.tecnico' } } },
};

export const esTecnico = async (id: number) =>
  (await prisma.usuario.count({ where: { id, activo: true, ...filtroTecnicos } })) > 0;

// Nunca se devuelve la contraseña, ni siquiera hasheada
const campos = { id: true, nombre: true, correo: true, _count: { select: { serviciosAsignados: true } } };

const traducirError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw httpError(400, 'Ya existe un usuario con ese correo');
    if (err.code === 'P2025') throw httpError(404, 'Técnico no encontrado');
  }
  throw err;
};

const validar = (data: { nombre?: string; correo?: string }) => {
  if (data.nombre !== undefined && !data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
  if (data.correo !== undefined && !data.correo.trim()) throw httpError(400, 'El correo es obligatorio');
};

// Evita que por esta vía se toque un usuario que no es técnico (por ejemplo, un administrador)
const obtenerTecnico = async (id: number) => {
  const usuario = await prisma.usuario.findFirst({ where: { id, ...filtroTecnicos } });
  if (!usuario) throw httpError(404, 'Técnico no encontrado');
  return usuario;
};

export const getAll = () =>
  prisma.usuario.findMany({ where: { activo: true, ...filtroTecnicos }, select: campos, orderBy: { nombre: 'asc' } });

// Los técnicos que se dan de alta desde esta pantalla reciben el rol Técnico de sistema
export const create = async (data: { nombre: string; correo: string; contrasena: string }) => {
  validar(data);
  validarContrasena(data.contrasena);
  const rol = await prisma.rol.findUniqueOrThrow({ where: { slug: 'tecnico' } });
  return prisma.usuario.create({
    data: { nombre: data.nombre.trim(), correo: data.correo.trim().toLowerCase(), contrasena: await bcrypt.hash(data.contrasena, 10), rolId: rol.id },
    select: campos,
  }).catch(traducirError);
};

// La contraseña es opcional al editar: si viene vacía se mantiene la actual
export const update = async (id: number, data: { nombre?: string; correo?: string; contrasena?: string }) => {
  validar(data);
  await obtenerTecnico(id);
  if (data.contrasena) validarContrasena(data.contrasena);
  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: data.nombre?.trim(),
      correo: data.correo?.trim(),
      ...(data.contrasena ? { contrasena: await bcrypt.hash(data.contrasena, 10) } : {}),
    },
    select: campos,
  }).catch(traducirError);
};

export const remove = async (id: number) => {
  const tecnico = await obtenerTecnico(id);
  if (await prisma.servicioTecnico.count({ where: { tecnicoId: id } }))
    throw httpError(409, 'No se puede eliminar: el técnico tiene servicios asignados');
  await prisma.usuario.delete({ where: { id } });
  return tecnico;
};
