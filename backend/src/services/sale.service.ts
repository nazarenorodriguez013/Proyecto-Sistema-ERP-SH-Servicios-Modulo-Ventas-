import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

const includeVenta = {
  detallesVenta: { include: { producto: { include: { categoria: true } } } },
  usuario: true,
};

// El precio y el total se calculan con los datos de la base: del cliente solo se aceptan producto y cantidad
export const createSale = async (
  usuarioId: number,
  items: { productoId: number; cantidad: number }[],
  medioPago: string,
  montoRecibido?: number | null,
) => {
  // Unifica ítems repetidos para validar el stock contra la cantidad total pedida de cada producto
  const cantidades = new Map<number, number>();
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0)
      throw new Error('La cantidad de cada ítem debe ser un número entero mayor a 0');
    cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);
  }

  // Todo en una transacción: si falla el descuento de stock de cualquier ítem, se revierte la venta entera
  const venta = await prisma.$transaction(async (tx) => {
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

    return tx.venta.create({
      data: {
        total,
        medioPago,
        montoRecibido: montoRecibido ?? null,
        usuarioId,
        detallesVenta: { create: detalles },
      },
      include: includeVenta,
    });
  });

  // Se avisa recién cuando la transacción quedó confirmada
  getIO()?.emit('stock-actualizado');
  return venta;
};

export const getAll = () =>
  prisma.venta.findMany({ include: includeVenta, orderBy: { creadoEn: 'desc' } });
