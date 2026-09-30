import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const MEDIO_CUENTA_CORRIENTE = 'Cuenta Corriente';

// Las ventas y servicios a cuenta corriente suman deuda y los pagos la restan; un saldo negativo es saldo a favor
export const calcularSaldo = (movimientos: { tipo: string; monto: number }[]) =>
  movimientos.reduce((saldo, m) => saldo + (m.tipo === 'PAGO' ? -m.monto : m.monto), 0);

export const createPago = async (clienteId: number, monto: number) => {
  if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0');
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error('Cliente no encontrado');
  return prisma.movimientoCuenta.create({ data: { clienteId, tipo: 'PAGO', concepto: 'Pago', monto } });
};

// Solo se puede borrar un movimiento suelto (un pago cargado a mano): el que viene de una venta o un
// servicio se borra desde ahí, para no dejar la cuenta corriente desincronizada con esos registros
export const remove = async (movementId: number) => {
  const movimiento = await prisma.movimientoCuenta.findUnique({ where: { id: movementId } });
  if (!movimiento) throw new Error('Movimiento no encontrado');
  if (movimiento.ventaId) throw new Error('Este movimiento pertenece a una venta: eliminá la venta desde el historial de compras');
  if (movimiento.servicioId) throw new Error('Este movimiento pertenece a un servicio técnico: eliminalo desde el servicio');
  await prisma.movimientoCuenta.delete({ where: { id: movementId } });
};

// Registra en la cuenta del cliente el cargo de una venta o servicio y devuelve cuánto saldo a favor se usó.
// A cuenta corriente se carga el total (el saldo a favor se descuenta solo); con otro medio de pago
// solo se carga la parte cubierta por el saldo a favor, y el resto lo paga el cliente en el momento.
export const registrarCargo = async (tx: Prisma.TransactionClient, cargo: {
  clienteId: number; tipo: 'VENTA' | 'SERVICIO'; concepto: string; total: number
  medioPago: string; usarSaldo: boolean; ventaId?: number; servicioId?: number
}) => {
  const movimientos = await tx.movimientoCuenta.findMany({ where: { clienteId: cargo.clienteId }, select: { tipo: true, monto: true } });
  const saldoAFavor = Math.max(0, -calcularSaldo(movimientos));
  const { clienteId, tipo, ventaId, servicioId } = cargo;

  if (cargo.medioPago === MEDIO_CUENTA_CORRIENTE) {
    if (cargo.total > 0) await tx.movimientoCuenta.create({ data: { clienteId, tipo, concepto: cargo.concepto, monto: cargo.total, ventaId, servicioId } });
    return Math.min(saldoAFavor, cargo.total);
  }

  const aplicado = cargo.usarSaldo ? Math.min(saldoAFavor, cargo.total) : 0;
  if (aplicado > 0) {
    await tx.movimientoCuenta.create({
      data: { clienteId, tipo, concepto: `${cargo.concepto} (saldo a favor aplicado)`, monto: aplicado, ventaId, servicioId },
    });
  }
  return aplicado;
};
