import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () =>
  prisma.categoria.findMany({ include: { _count: { select: { productos: true } } }, orderBy: { nombre: 'asc' } });

export const create = (nombre: string) => {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return prisma.categoria.create({ data: { nombre: nombre.trim() } });
};

export const update = (id: number, nombre: string) => {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return prisma.categoria.update({ where: { id }, data: { nombre: nombre.trim() } });
};

export const remove = async (id: number) => {
  if (await prisma.producto.count({ where: { categoriaId: id } }))
    throw new Error('No se puede eliminar: tiene productos asignados');
  return prisma.categoria.delete({ where: { id } });
};
