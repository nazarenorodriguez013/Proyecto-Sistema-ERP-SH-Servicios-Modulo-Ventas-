import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Los pagos restan de la deuda, el resto de movimientos (venta/alquiler/servicio) suma
const calcularSaldo = (movimientos: { tipo: string; monto: number }[]) =>
  movimientos.reduce((saldo, m) => saldo + (m.tipo === 'PAGO' ? -m.monto : m.monto), 0);

export const getAll = async () => {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: 'asc' },
    include: { movimientos: { select: { tipo: true, monto: true } } },
  });
  return clientes.map(({ movimientos, ...cliente }) => ({ ...cliente, saldo: calcularSaldo(movimientos) }));
};

export const getById = async (id: number) => {
  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id },
    include: { movimientos: { orderBy: { creadoEn: 'desc' } } },
  });
  const { movimientos, ...datos } = cliente;
  return { ...datos, movimientos, saldo: calcularSaldo(movimientos) };
};

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
