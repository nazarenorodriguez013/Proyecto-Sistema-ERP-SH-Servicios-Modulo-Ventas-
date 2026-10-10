import { PrismaClient, Prisma } from '@prisma/client';
import { httpError } from '../utils/http';
import { MODULOS_PERMISOS, SLUG_ADMIN, TODOS_LOS_PERMISOS, normalizarPermisos } from '../utils/permisos';

const prisma = new PrismaClient();

type Actor = { id: number; rolSlug: string };

const resumen = <T extends { slug: string; permisos: { permiso: string }[]; _count: { usuarios: number } }>(r: T) => {
  const { permisos, _count, ...rol } = r;
  return {
    ...rol,
    usuarios: _count.usuarios,
    // El Administrador tiene todos aunque no estén guardados
    permisos: r.slug === SLUG_ADMIN ? TODOS_LOS_PERMISOS : normalizarPermisos(permisos.map(p => p.permiso)),
  };
};

const incluir = { permisos: { select: { permiso: true } }, _count: { select: { usuarios: true } } } as const;

// Los de sistema primero, en el orden en que se crearon; después los personalizados
export const getAll = async () =>
  (await prisma.rol.findMany({ include: incluir, orderBy: [{ esSistema: 'desc' }, { id: 'asc' }] })).map(resumen);

export const getById = async (id: number) => {
  const rol = await prisma.rol.findUnique({ where: { id }, include: incluir });
  if (!rol) throw httpError(404, 'Rol no encontrado');
  return resumen(rol);
};

export const catalogo = () => MODULOS_PERMISOS;

// "Encargado de depósito" -> "encargado-de-deposito" (sin acentos ni símbolos)
const slugDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rol';

const validarNombre = (nombre: unknown) => {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) throw httpError(400, 'El nombre es obligatorio');
  if (n.length > 60) throw httpError(400, 'El nombre no puede tener más de 60 caracteres');
  return n;
};

const traducirError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw httpError(400, 'Ya existe un rol con ese nombre');
  throw err;
};

export const create = async (data: Record<string, unknown>) => {
  const nombre = validarNombre(data.nombre);
  // El slug es único: si ya existe uno igual se le agrega un número
  let slug = slugDe(nombre);
  for (let i = 2; await prisma.rol.findUnique({ where: { slug } }); i++) slug = `${slugDe(nombre)}-${i}`;
  const rol = await prisma.rol.create({
    data: {
      nombre, slug,
      descripcion: typeof data.descripcion === 'string' ? data.descripcion.trim().slice(0, 255) || null : null,
      permisos: { create: normalizarPermisos(data.permisos).map(permiso => ({ permiso })) },
    },
    include: incluir,
  }).catch(traducirError);
  return resumen(rol);
};

export const update = async (id: number, actor: Actor, data: Record<string, unknown>) => {
  const actual = await prisma.rol.findUnique({ where: { id } });
  if (!actual) throw httpError(404, 'Rol no encontrado');
  // Así nadie se agrega permisos a sí mismo editando su propio rol (salvo el administrador, que ya los tiene todos)
  if (actor.rolSlug !== SLUG_ADMIN) {
    const propio = await prisma.usuario.findUnique({ where: { id: actor.id }, select: { rolId: true } });
    if (propio?.rolId === id) throw httpError(403, 'No podés modificar los permisos de tu propio rol');
    if (actual.slug === SLUG_ADMIN) throw httpError(403, 'Solo un administrador puede modificar el rol Administrador');
  }

  const cambios: Prisma.RolUpdateInput = {};
  if (data.nombre !== undefined) cambios.nombre = validarNombre(data.nombre);
  if (data.descripcion !== undefined) cambios.descripcion = typeof data.descripcion === 'string' ? data.descripcion.trim().slice(0, 255) || null : null;
  // Los roles de sistema no se pueden desactivar (los usuarios quedarían sin acceso a nada)
  if (data.activo !== undefined && !actual.esSistema) cambios.activo = !!data.activo;

  const rol = await prisma.$transaction(async tx => {
    // El Administrador conserva siempre todos los permisos: lo que llegue para él se ignora
    if (data.permisos !== undefined && actual.slug !== SLUG_ADMIN) {
      await tx.rolPermiso.deleteMany({ where: { rolId: id } });
      await tx.rolPermiso.createMany({ data: normalizarPermisos(data.permisos).map(permiso => ({ rolId: id, permiso })) });
    }
    return tx.rol.update({ where: { id }, data: cambios, include: incluir });
  }).catch(traducirError);
  return resumen(rol);
};

export const remove = async (id: number) => {
  const rol = await prisma.rol.findUnique({ where: { id }, include: { _count: { select: { usuarios: true } } } });
  if (!rol) throw httpError(404, 'Rol no encontrado');
  if (rol.esSistema) throw httpError(400, 'Los roles de sistema no se pueden eliminar');
  if (rol._count.usuarios) throw httpError(409, 'No se puede eliminar: hay usuarios con este rol. Asignales otro rol primero');
  await prisma.rol.delete({ where: { id } });
  return rol;
};
