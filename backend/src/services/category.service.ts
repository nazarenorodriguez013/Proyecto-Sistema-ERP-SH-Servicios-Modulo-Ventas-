import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () => prisma.categoria.findMany();

export const create = (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return prisma.categoria.create({ data: { nombre: nombre.trim() } });
};

export const update = (id: number, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return prisma.categoria.update({ where: { id }, data: { nombre: nombre.trim() } });
};

export const remove = (id: number) => prisma.categoria.delete({ where: { id } });
