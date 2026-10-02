import { PrismaClient, AreaNotificacion, Prisma } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

// Crea el aviso y le dice a todas las pantallas abiertas que refresquen la campanita
export const crear = async (data: { area: AreaNotificacion; usuarioId?: number | null; titulo: string; mensaje: string; servicioId?: number }) => {
  await prisma.notificacion.create({ data: { ...data, usuarioId: data.usuarioId ?? null } });
  getIO()?.emit('notificaciones-actualizadas');
};

type Destinatario = { id: number; rol: string; modulos: string[] };

// Qué avisos ve cada uno: el técnico solo los que son para él; el resto, los de las áreas a las que tiene acceso
// (el administrador, todas)
const filtroVisibles = (u: Destinatario): Prisma.NotificacionWhereInput => {
  if (u.rol === 'TECNICO') return { area: 'SERVICIOS', usuarioId: u.id };
  const areas: AreaNotificacion[] = [];
  if (u.rol === 'ADMIN' || u.modulos.includes('inventario')) areas.push('INVENTARIO');
  if (u.rol === 'ADMIN' || u.modulos.includes('servicios')) areas.push('SERVICIOS');
  return { area: { in: areas } };
};

export const listar = async (userId: number) => {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
  const where = filtroVisibles(usuario);
  const [items, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({ where, orderBy: { creadoEn: 'desc' }, take: 30 }),
    prisma.notificacion.count({ where: { ...where, creadoEn: { gt: usuario.notifVistasHasta } } }),
  ]);
  return { items: items.map(n => ({ ...n, nueva: n.creadoEn > usuario.notifVistasHasta })), noLeidas };
};

export const marcarLeidas = async (userId: number) => {
  await prisma.usuario.update({ where: { id: userId }, data: { notifVistasHasta: new Date() } });
};
