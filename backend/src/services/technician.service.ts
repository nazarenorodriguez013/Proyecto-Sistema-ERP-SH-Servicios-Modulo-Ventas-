import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';
import { httpError } from '../utils/http';
import { modulosPorRol } from '../utils/modulos';

const prisma = new PrismaClient();

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
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (usuario?.rol !== 'TECNICO') throw httpError(404, 'Técnico no encontrado');
  return usuario;
};

export const getAll = () =>
  prisma.usuario.findMany({ where: { rol: 'TECNICO' }, select: campos, orderBy: { nombre: 'asc' } });

export const create = async (data: { nombre: string; correo: string; contrasena: string }) => {
  validar(data);
  if (!data.contrasena || data.contrasena.length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
  return prisma.usuario.create({
    data: { nombre: data.nombre.trim(), correo: data.correo.trim().toLowerCase(), contrasena: await bcrypt.hash(data.contrasena, 10), rol: 'TECNICO', modulos: modulosPorRol('TECNICO') },
    select: campos,
  }).catch(traducirError);
};

// La contraseña es opcional al editar: si viene vacía se mantiene la actual
export const update = async (id: number, data: { nombre?: string; correo?: string; contrasena?: string }) => {
  validar(data);
  await obtenerTecnico(id);
  if (data.contrasena && data.contrasena.length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
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
  await obtenerTecnico(id);
  if (await prisma.servicioTecnico.count({ where: { tecnicoId: id } }))
    throw httpError(409, 'No se puede eliminar: el técnico tiene servicios asignados');
  await prisma.usuario.delete({ where: { id } });
};
