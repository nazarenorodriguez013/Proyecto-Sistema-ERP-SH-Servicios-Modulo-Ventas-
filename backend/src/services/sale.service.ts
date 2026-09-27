import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';
import { MEDIO_CUENTA_CORRIENTE, registrarCargo } from './movement.service';

const prisma = new PrismaClient();

const includeVenta = {
  detallesVenta: { include: { producto: { include: { categoria: true } } } },
  usuario: true,
  cliente: true,
};

// El precio y el total se calculan con los datos de la base: del frontend solo se aceptan producto y cantidad
export const createSale = async (
  usuarioId: number,
  items: { productoId: number; cantidad: number }[],
  medioPago: string,
  montoRecibido?: number | null,
  clienteId?: number | null,
  usarSaldo = true,
) => {
  if (medioPago === MEDIO_CUENTA_CORRIENTE && !clienteId)
    throw new Error('Para vender a cuenta corriente hay que seleccionar un cliente');

  // Unifica ítems repetidos para validar el stock contra la cantidad total pedida de cada producto
  const cantidades = new Map<number, number>();
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0)
      throw new Error('La cantidad de cada ítem debe ser un número entero mayor a 0');
    cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);
  }

  // Todo en una transacción: si falla el descuento de stock de cualquier ítem, se revierte la venta entera
  const venta = await prisma.$transaction(async (tx) => {
    if (clienteId && !(await tx.cliente.findUnique({ where: { id: clienteId } })))
      throw new Error('Cliente no encontrado');

    const detalles = [];
    for (const [productoId, cantidad] of cantidades) {
      const producto = await tx.producto.findUnique({ where: { id: productoId } });
      if (!producto) throw new Error('Producto no encontrado');
      if (!producto.activo) throw new Error(`"${producto.nombre}" no está disponible para la venta`);

      // Descuenta solo si alcanza el stock en ese momento, así dos ventas simultáneas no lo dejan negativo
      const { count } = await tx.producto.updateMany({
        where: { id: productoId, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (count === 0)
        throw new Error(`Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);

      detalles.push({ productoId, cantidad, precioUnitario: producto.precio });
    }

    const total = detalles.reduce((sum, d) => sum + d.cantidad * d.precioUnitario, 0);

    const nueva = await tx.venta.create({
      data: {
        total,
        medioPago,
        montoRecibido: montoRecibido ?? null,
        usuarioId,
        clienteId: clienteId ?? null,
        detallesVenta: { create: detalles },
      },
      include: includeVenta,
    });

    if (!clienteId) return nueva;

    // Con cliente: la venta pasa por su cuenta corriente, que descuenta primero el saldo a favor
    const saldoAplicado = await registrarCargo(tx, {
      clienteId, tipo: 'VENTA', concepto: `Venta #${nueva.id}`, total, medioPago, usarSaldo, ventaId: nueva.id,
    });
    if (!saldoAplicado) return nueva;
    return tx.venta.update({ where: { id: nueva.id }, data: { saldoAplicado }, include: includeVenta });
  });

  // Se avisa recién cuando la transacción quedó confirmada
  getIO()?.emit('stock-actualizado');
  return venta;
};

export const getAll = () =>
  prisma.venta.findMany({ include: includeVenta, orderBy: { creadoEn: 'desc' } });
