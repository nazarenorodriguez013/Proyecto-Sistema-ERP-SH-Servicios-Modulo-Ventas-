import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Trae todas las categorías ordenadas A→Z
export const getAll = () => prisma.category.findMany({ orderBy: { name: 'asc' } });

// Inserta una nueva categoría con el nombre dado
export const create = (name: string) => prisma.category.create({ data: { name } });
