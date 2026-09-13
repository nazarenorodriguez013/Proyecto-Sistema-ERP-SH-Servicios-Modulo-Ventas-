import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () =>
  prisma.cliente.findMany({ orderBy: { nombre: 'asc' } });

export const getById = (id: number) =>
  prisma.cliente.findUniqueOrThrow({ where: { id } });

// Valida los campos antes de tocar la base; se comparte entre create y update
const validateFields = (data: { nombre?: string }) => {
  if (data.nombre !== undefined && !data.nombre.trim()) throw new Error('El nombre del cliente es obligatorio');
};

export const create = async (data: {
  nombre: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  activo?: boolean;
}) => {
  validateFields(data);
  return prisma.cliente.create({ data });
};

export const update = async (id: number, data: {
  nombre?: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  activo?: boolean;
}) => {
  validateFields(data);
  return prisma.cliente.update({ where: { id }, data });
};

export const remove = (id: number) => prisma.cliente.delete({ where: { id } });
