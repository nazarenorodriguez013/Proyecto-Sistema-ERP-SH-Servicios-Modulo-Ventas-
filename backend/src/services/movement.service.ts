import { PrismaClient, TipoMovimiento } from '@prisma/client';

const prisma = new PrismaClient();

// VENTA se genera sola desde el punto de venta; desde la cuenta del cliente solo se cargan pagos
const TIPOS_MANUALES: TipoMovimiento[] = ['PAGO'];

export const create = (clienteId: number, tipo: TipoMovimiento, concepto: string, monto: number) => {
  if (!TIPOS_MANUALES.includes(tipo)) throw new Error('Tipo de movimiento inválido');
  if (!concepto?.trim()) throw new Error('El concepto es obligatorio');
  if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0');
  return prisma.movimientoCuenta.create({ data: { clienteId, tipo, concepto, monto } });
};

export const remove = (id: number) => prisma.movimientoCuenta.delete({ where: { id } });
