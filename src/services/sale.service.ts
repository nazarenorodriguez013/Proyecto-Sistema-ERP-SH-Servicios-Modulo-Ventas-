import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export const createSale = async (
  usuarioId: number,
  items: { productoId: number; cantidad: number; precioUnitario: number }[],
  medioPago: string,
  montoRecibido?: number | null,
) => {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
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
