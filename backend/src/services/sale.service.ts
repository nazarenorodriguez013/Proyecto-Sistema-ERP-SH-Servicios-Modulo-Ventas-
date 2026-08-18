import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export const createSale = async (
  usuarioId: number,
  items: { productoId: number; cantidad: number; precioUnitario: number }[],
  medioPago: string,
  montoRecibido?: number | null,
) => {
  // Todo en una transacción: si falla el descuento de stock de cualquier ítem, se revierte la venta entera
  return prisma.$transaction(async (tx) => {
    // Verifica stock de todos los ítems ANTES de crear la venta, para no dejar registros a medias
    for (const item of items) {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0)
        throw new Error('La cantidad de cada ítem debe ser un número entero mayor a 0');
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) throw new Error(`Producto no encontrado`);
      if (producto.stock < item.cantidad)
        throw new Error(`Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);
    }

    const total = items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);

    const venta = await tx.venta.create({
      data: {
        total,
        medioPago,
        montoRecibido: montoRecibido ?? null,
        usuarioId,
        detallesVenta: {
          create: items.map(i => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
        },
      },
      include: { detallesVenta: { include: { producto: { include: { categoria: true } } } }, usuario: true },
    });

    // Descuenta stock recién después de crear la venta y avisa por websocket si quedó bajo
    for (const item of items) {
      const updated = await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: item.cantidad } },
        include: { categoria: true },
      });
      if (updated.activo && updated.stock <= updated.stockMinimo) {
        getIO()?.emit('low-stock', updated);
      }
    }

    return venta;
  });
};

export const getAll = () =>
  prisma.venta.findMany({
    include: { detallesVenta: { include: { producto: { include: { categoria: true } } } }, usuario: true },
    orderBy: { creadoEn: 'desc' },
  });
