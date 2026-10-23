import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const MEDIO_CUENTA_CORRIENTE = 'Cuenta Corriente';

// Los movimientos que siguen vigentes: los pagos eliminados quedan guardados pero no cuentan ni se muestran
export const VIGENTES = { eliminadoEn: null } satisfies Prisma.MovimientoCuentaWhereInput;

// Las ventas y servicios a cuenta corriente suman deuda y los pagos la restan; un saldo negativo es saldo a favor
export const calcularSaldo = (movimientos: { tipo: string; monto: number }[]) =>
  movimientos.reduce((saldo, m) => saldo + (m.tipo === 'PAGO' ? -m.monto : m.monto), 0);

// Saldo de cuenta corriente del cliente en este momento (positivo = debe, negativo = a favor)
export const saldoDeCliente = async (tx: Prisma.TransactionClient, clienteId: number) =>
  calcularSaldo(await tx.movimientoCuenta.findMany({ where: { clienteId, ...VIGENTES }, select: { tipo: true, monto: true } }));

export const createPago = async (clienteId: number, monto: number, usuario: { id: number; nombre: string }) => {
  if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0');
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error('Cliente no encontrado');
  return prisma.movimientoCuenta.create({
    data: { clienteId, tipo: 'PAGO', concepto: 'Pago', monto, registradoPorId: usuario.id, registradoPorNombre: usuario.nombre },
  });
};

// Solo se puede eliminar un movimiento suelto (un pago cargado a mano): el que viene de una venta o un
// servicio se borra desde ahí, para no dejar la cuenta corriente desincronizada con esos registros.
// No se borra de la base: queda guardado con quién lo eliminó, cuándo y por qué, aunque haya sido un error de carga
export const remove = async (clienteId: number, movementId: number, usuario: { id: number; nombre: string }, motivo?: string) => {
  const movimiento = await prisma.movimientoCuenta.findFirst({ where: { id: movementId, clienteId, ...VIGENTES } });
  if (!movimiento) throw new Error('Movimiento no encontrado');
  if (movimiento.ventaId) throw new Error('Este movimiento pertenece a una venta: eliminá la venta desde el historial de compras');
  if (movimiento.servicioId) throw new Error('Este movimiento pertenece a un servicio técnico: eliminalo desde el servicio');
  return prisma.movimientoCuenta.update({
    where: { id: movementId },
    data: {
      eliminadoEn: new Date(), eliminadoPorId: usuario.id, eliminadoPorNombre: usuario.nombre,
      motivoEliminacion: motivo?.trim().slice(0, 255) || null,
    },
    include: { cliente: { select: { nombre: true } } },
  });
};

// Pagos eliminados, del más reciente al más viejo. A diferencia de la auditoría (7 días) no se borran nunca
const POR_PAGINA = 50;
export const eliminados = async (q: string, pagina: number) => {
  const texto = q.trim();
  const where: Prisma.MovimientoCuentaWhereInput = {
    eliminadoEn: { not: null },
    ...(texto ? { OR: [
      { cliente: { nombre: { contains: texto, mode: 'insensitive' } } },
      { eliminadoPorNombre: { contains: texto, mode: 'insensitive' } },
      { registradoPorNombre: { contains: texto, mode: 'insensitive' } },
      { motivoEliminacion: { contains: texto, mode: 'insensitive' } },
    ] } : {}),
  };
  pagina = Math.max(1, pagina);
  const [total, pagos] = await Promise.all([
    prisma.movimientoCuenta.count({ where }),
    prisma.movimientoCuenta.findMany({
      where, orderBy: { eliminadoEn: 'desc' }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
      include: { cliente: { select: { id: true, nombre: true } } },
    }),
  ]);
  return { total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), pagos };
};

// Registra en la cuenta del cliente el cargo de una venta o servicio y devuelve cuánto saldo a favor se usó.
// A cuenta corriente se carga el total (el saldo a favor se descuenta solo); con otro medio de pago
// solo se carga la parte cubierta por el saldo a favor, y el resto lo paga el cliente en el momento.
export const registrarCargo = async (tx: Prisma.TransactionClient, cargo: {
  clienteId: number; tipo: 'VENTA' | 'SERVICIO'; concepto: string; total: number
  medioPago: string; usarSaldo: boolean; ventaId?: number; servicioId?: number
}) => {
  const movimientos = await tx.movimientoCuenta.findMany({ where: { clienteId: cargo.clienteId, ...VIGENTES }, select: { tipo: true, monto: true } });
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
