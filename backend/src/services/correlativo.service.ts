import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Siguiente número de la secuencia de un tipo de comprobante (Factura, Remito o Presupuesto), compartida
// entre Ventas y Servicios Técnicos. El upsert con incremento es una sola operación atómica en la base,
// así que dos comprobantes generados al mismo tiempo nunca se llevan el mismo número.
export const siguienteNumero = async (
  tipo: 'FACTURA' | 'REMITO' | 'PRESUPUESTO',
  tx: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<number> => {
  const contador = await tx.correlativo.upsert({
    where: { tipo },
    update: { ultimoNumero: { increment: 1 } },
    create: { tipo, ultimoNumero: 1 },
  });
  return contador.ultimoNumero;
};
