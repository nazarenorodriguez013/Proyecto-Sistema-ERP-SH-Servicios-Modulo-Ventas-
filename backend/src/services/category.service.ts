import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () => prisma.categoria.findMany();

export const create = (nombre: string) => prisma.categoria.create({ data: { nombre } });

export const update = (id: number, nombre: string) =>
  prisma.categoria.update({ where: { id }, data: { nombre } });

export const remove = (id: number) => prisma.categoria.delete({ where: { id } });
