import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createPago = async (clienteId: number, monto: number) => {
  if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0');
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error('Cliente no encontrado');
  return prisma.movimientoCuenta.create({ data: { clienteId, tipo: 'PAGO', concepto: 'Pago', monto } });
};
