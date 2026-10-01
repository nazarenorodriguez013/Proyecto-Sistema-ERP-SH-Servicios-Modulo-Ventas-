import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/http';

const prisma = new PrismaClient();

const CAMPOS_TEXTO = ['razonSocial', 'rubro', 'domicilio', 'condicionIva', 'telefono', 'email', 'cuit', 'ingresosBrutos', 'inicioActividades'] as const;

export const get = () => prisma.empresa.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const update = async (data: Record<string, unknown>) => {
  const cambios: Record<string, string | number> = {};
  for (const campo of CAMPOS_TEXTO) {
    if (data[campo] !== undefined) cambios[campo] = String(data[campo]).trim();
  }
  if (cambios.razonSocial === '') throw httpError(400, 'La razón social es obligatoria');
  if (data.puntoVenta !== undefined) {
    const pv = Number(data.puntoVenta);
    if (!Number.isInteger(pv) || pv < 1 || pv > 9999) throw httpError(400, 'El punto de venta debe ser un número entre 1 y 9999');
    cambios.puntoVenta = pv;
  }
  return prisma.empresa.upsert({ where: { id: 1 }, update: cambios, create: { id: 1, ...cambios } });
};
