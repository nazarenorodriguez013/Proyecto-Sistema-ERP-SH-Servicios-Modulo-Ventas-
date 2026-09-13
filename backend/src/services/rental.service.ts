import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAll = () =>
  prisma.alquiler.findMany({
    include: { maquina: true, usuario: true },
    orderBy: { creadoEn: 'desc' },
  });

export const create = async (
  usuarioId: number,
  data: { maquinaId: number; cliente: string; fechaInicio: string; fechaFin: string },
) => {
  if (!data.cliente?.trim()) throw new Error('El nombre del cliente es obligatorio');

  const fechaInicio = new Date(data.fechaInicio);
  const fechaFin = new Date(data.fechaFin);
  if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime()))
    throw new Error('Las fechas ingresadas no son válidas');
  if (fechaFin <= fechaInicio)
    throw new Error('La fecha de finalización debe ser posterior a la de inicio');

  // Todo en una transacción: si la máquina no tiene stock disponible, no se crea el alquiler ni se descuenta nada
  return prisma.$transaction(async (tx) => {
    const maquina = await tx.maquina.findUnique({ where: { id: data.maquinaId } });
    if (!maquina) throw new Error('Máquina no encontrada');
    if (!maquina.activo) throw new Error('La máquina no está disponible para alquiler');
    if (maquina.stock < 1) throw new Error(`Sin unidades disponibles de "${maquina.nombre}"`);

    const dias = Math.max(1, Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)));
    const total = dias * maquina.tarifaDiaria;

    const alquiler = await tx.alquiler.create({
      data: {
        maquinaId: data.maquinaId,
        cliente: data.cliente.trim(),
        fechaInicio,
        fechaFin,
        total,
        usuarioId,
      },
      include: { maquina: true, usuario: true },
    });

    // Descuenta una unidad de la flota disponible recién después de crear el alquiler
    await tx.maquina.update({ where: { id: data.maquinaId }, data: { stock: { decrement: 1 } } });

    return alquiler;
  });
};

// Finaliza o cancela el alquiler y devuelve la unidad al stock disponible de la flota
export const updateEstado = async (id: number, estado: 'FINALIZADO' | 'CANCELADO') => {
  return prisma.$transaction(async (tx) => {
    const alquiler = await tx.alquiler.findUnique({ where: { id } });
    if (!alquiler) throw new Error('Alquiler no encontrado');
    if (alquiler.estado !== 'ACTIVO') throw new Error('El alquiler ya fue cerrado');

    const updated = await tx.alquiler.update({
      where: { id },
      data: { estado },
      include: { maquina: true, usuario: true },
    });

    await tx.maquina.update({ where: { id: alquiler.maquinaId }, data: { stock: { increment: 1 } } });

    return updated;
  });
};
