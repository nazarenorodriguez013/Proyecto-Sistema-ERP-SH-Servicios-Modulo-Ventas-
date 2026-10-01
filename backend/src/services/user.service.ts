import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, Rol } from '@prisma/client';
import { httpError } from '../utils/http';
import { normalizarModulos } from '../utils/modulos';

const prisma = new PrismaClient();

// Nunca se devuelve la contraseña ni el token de recuperación
const campos = { id: true, nombre: true, correo: true, rol: true, modulos: true, activo: true, creadoEn: true } as const;

const ROLES: Rol[] = ['ADMIN', 'VENDEDOR', 'TECNICO'];

export const validarContrasena = (contrasena: unknown) => {
  if (typeof contrasena !== 'string' || contrasena.length < 8 || !/[A-ZÁÉÍÓÚÑ]/.test(contrasena))
    throw httpError(400, 'La contraseña debe tener al menos 8 caracteres y una mayúscula');
  return contrasena;
};

export const normalizarCorreo = (correo: unknown) => {
  const c = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw httpError(400, 'El correo no es válido');
  return c;
};

const traducirError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw httpError(400, 'Ya existe un usuario con ese correo');
    if (err.code === 'P2025') throw httpError(404, 'Usuario no encontrado');
  }
  throw err;
};

const validarRol = (rol: unknown): Rol => {
  if (!ROLES.includes(rol as Rol)) throw httpError(400, 'El rol no es válido');
  return rol as Rol;
};

export const getAll = () => prisma.usuario.findMany({ select: campos, orderBy: { nombre: 'asc' } });

export const create = async (data: { nombre?: string; correo?: string; contrasena?: string; rol?: string; modulos?: unknown }) => {
  if (!data.nombre?.trim()) throw httpError(400, 'El nombre es obligatorio');
  const rol = validarRol(data.rol);
  const usuario = await prisma.usuario.create({
    data: {
      nombre: data.nombre.trim(), correo: normalizarCorreo(data.correo), rol,
      contrasena: await bcrypt.hash(validarContrasena(data.contrasena), 10),
      modulos: normalizarModulos(data.modulos, rol),
    },
    select: campos,
  }).catch(traducirError);
  return usuario;
};

// Siempre tiene que quedar al menos un administrador activo, si no nadie podría volver a gestionar usuarios
const quedaOtroAdmin = async (excluirId: number) =>
  (await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true, id: { not: excluirId } } })) > 0;

export const update = async (id: number, actorId: number, data: {
  nombre?: string; correo?: string; contrasena?: string; rol?: string; modulos?: unknown; activo?: boolean
}) => {
  const actual = await prisma.usuario.findUnique({ where: { id } });
  if (!actual) throw httpError(404, 'Usuario no encontrado');

  const rol = data.rol !== undefined ? validarRol(data.rol) : actual.rol;
  const activo = data.activo !== undefined ? !!data.activo : actual.activo;
  if (actual.rol === 'ADMIN' && actual.activo && (rol !== 'ADMIN' || !activo) && !(await quedaOtroAdmin(id)))
    throw httpError(400, 'Tiene que quedar al menos un administrador activo');
  if (id === actorId && !activo) throw httpError(400, 'No podés desactivar tu propio usuario');

  const cambios: Prisma.UsuarioUpdateInput = { rol, activo };
  if (data.nombre !== undefined) {
    if (!data.nombre.trim()) throw httpError(400, 'El nombre es obligatorio');
    cambios.nombre = data.nombre.trim();
  }
  if (data.correo !== undefined) cambios.correo = normalizarCorreo(data.correo);
  if (data.contrasena) cambios.contrasena = await bcrypt.hash(validarContrasena(data.contrasena), 10);
  // Si cambia el rol, los módulos se ajustan a lo que ese rol permite
  if (data.modulos !== undefined || rol !== actual.rol) cambios.modulos = normalizarModulos(data.modulos ?? actual.modulos, rol);

  return prisma.usuario.update({ where: { id }, data: cambios, select: campos }).catch(traducirError);
};

export const remove = async (id: number, actorId: number) => {
  if (id === actorId) throw httpError(400, 'No podés eliminar tu propio usuario');
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { _count: { select: { ventas: true, serviciosAsignados: true } } } });
  if (!usuario) throw httpError(404, 'Usuario no encontrado');
  if (usuario.rol === 'ADMIN' && usuario.activo && !(await quedaOtroAdmin(id))) throw httpError(400, 'Tiene que quedar al menos un administrador activo');
  if (usuario._count.ventas || usuario._count.serviciosAsignados)
    throw httpError(409, 'No se puede eliminar: tiene ventas o servicios registrados. Desactivalo en su lugar');
  await prisma.usuario.delete({ where: { id } });
};
