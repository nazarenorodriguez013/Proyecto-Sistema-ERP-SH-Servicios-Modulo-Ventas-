import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Devuelve todos los productos con la categoría anidada, ordenados A→Z
export const getAll = () =>
  prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } });

// Busca un producto por ID incluyendo su categoría; null si no existe
export const getById = (id: number) =>
  prisma.product.findUnique({ where: { id }, include: { category: true } });

// Crea un producto nuevo con nombre, precio, stock y categoría
export const create = (data: { name: string; price: number; stock: number; categoryId: number }) =>
  prisma.product.create({ data, include: { category: true } });

// Actualiza solo los campos enviados (patch parcial)
export const update = (id: number, data: { name?: string; price?: number; stock?: number; categoryId?: number }) =>
  prisma.product.update({ where: { id }, data, include: { category: true } });

// Elimina el producto; Prisma lanza error si hay registros relacionados
export const remove = (id: number) => prisma.product.delete({ where: { id } });
