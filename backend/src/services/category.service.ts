import { PrismaClient, TipoProducto } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () =>
  prisma.categoria.findMany({ include: { _count: { select: { productos: true } } }, orderBy: { nombre: 'asc' } });

const validarTipo = (tipo: unknown): TipoProducto => {
  if (tipo !== 'REPUESTO' && tipo !== 'MAQUINARIA') throw new Error('Elegí para qué es la categoría: repuestos o maquinaria');
  return tipo;
};

export const create = (nombre: string, tipo: unknown) => {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return prisma.categoria.create({ data: { nombre: nombre.trim(), tipo: validarTipo(tipo) } });
};

export const update = async (id: number, nombre: string, tipo?: unknown) => {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('El nombre de la categoría es obligatorio');
  const nuevoTipo = tipo === undefined ? undefined : validarTipo(tipo);
  // No se puede cambiar el tipo si ya tiene artículos del otro tipo: quedarían en una categoría que no les corresponde
  if (nuevoTipo && await prisma.producto.count({ where: { categoriaId: id, tipoProducto: { not: nuevoTipo } } }))
    throw new Error('No se puede cambiar el tipo: la categoría tiene artículos del otro tipo. Pasalos a otra categoría primero');
  return prisma.categoria.update({ where: { id }, data: { nombre: nombre.trim(), ...(nuevoTipo ? { tipo: nuevoTipo } : {}) } });
};

export const remove = async (id: number) => {
  if (await prisma.producto.count({ where: { categoriaId: id } }))
    throw new Error('No se puede eliminar: tiene productos asignados');
  return prisma.categoria.delete({ where: { id } });
};
