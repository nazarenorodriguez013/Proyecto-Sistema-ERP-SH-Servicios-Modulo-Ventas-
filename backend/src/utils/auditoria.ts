import { Request } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

type Evento = {
  accion: string; seccion: string; descripcion: string
  entidad?: string; entidadId?: number; datos?: Record<string, unknown>
  // Para eventos sin sesión (por ejemplo un login): a quién corresponde
  usuario?: { id: number; nombre: string } | null
};

const ipDe = (req: Request) => (req.ip ?? '').replace(/^::ffff:/, '') || null;

// Registra quién hizo qué. Nunca rompe la operación principal: si falla, solo queda en el log del servidor
export const auditar = (req: AuthRequest, e: Evento) => {
  const usuario = e.usuario !== undefined ? e.usuario : req.user ? { id: req.user.id, nombre: req.user.nombre } : null;
  prisma.auditoria.create({
    data: {
      usuarioId: usuario?.id ?? null, usuarioNombre: usuario?.nombre ?? null,
      accion: e.accion.slice(0, 60), seccion: e.seccion.slice(0, 60),
      entidad: e.entidad ?? null, entidadId: e.entidadId ?? null,
      descripcion: e.descripcion.slice(0, 255),
      datos: e.datos && Object.keys(e.datos).length ? (e.datos as Prisma.InputJsonValue) : Prisma.JsonNull,
      ip: ipDe(req), userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
    },
  }).catch(err => console.error('[AUDITORIA]', err));
};

// Compara el registro antes y después y devuelve solo lo que cambió: { campo: { antes, ahora } }
export const diferencias = (antes: Record<string, unknown>, ahora: Record<string, unknown>, campos: string[]) => {
  const cambios: Record<string, { antes: unknown; ahora: unknown }> = {};
  for (const campo of campos) {
    const a = antes[campo] ?? null, b = ahora[campo] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) cambios[campo] = { antes: a, ahora: b };
  }
  return cambios;
};

// El registro solo guarda la última semana (igual que el catálogo); se revisa al arrancar y una vez por día
const DIAS_RETENCION = 7;
export const purgarAuditoriaVieja = () =>
  prisma.auditoria.deleteMany({ where: { creadoEn: { lt: new Date(Date.now() - DIAS_RETENCION * 86_400_000) } } })
    .catch(err => console.error('[AUDITORIA] purga', err));
