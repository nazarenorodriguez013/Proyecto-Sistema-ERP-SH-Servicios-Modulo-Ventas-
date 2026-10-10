import { PrismaClient, AreaNotificacion, Prisma } from '@prisma/client';
import { getIO } from '../socket';
import { permisosDeRol } from '../utils/permisos';

const prisma = new PrismaClient();

// Crea el aviso y le dice a todas las pantallas abiertas que refresquen la campanita
export const crear = async (data: { area: AreaNotificacion; usuarioId?: number | null; titulo: string; mensaje: string; servicioId?: number }) => {
  await prisma.notificacion.create({ data: { ...data, usuarioId: data.usuarioId ?? null } });
  getIO()?.emit('notificaciones-actualizadas');
};

// Qué avisos ve cada uno según los permisos de su rol: los de las áreas que maneja (depósito o servicios)
// y, además, los dirigidos a él (por ejemplo al técnico asignado). El administrador ve todo.
const filtroVisibles = (id: number, permisos: string[]): Prisma.NotificacionWhereInput => {
  const areas: AreaNotificacion[] = [];
  if (permisos.includes('retiros.gestionar')) areas.push('INVENTARIO');
  if (permisos.includes('servicios.gestionar')) areas.push('SERVICIOS');
  return { OR: [{ area: { in: areas } }, { usuarioId: id }] };
};

export const listar = async (userId: number) => {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: userId }, include: { rol: { include: { permisos: true } } } });
  const where = filtroVisibles(usuario.id, permisosDeRol(usuario.rol));
  const [items, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({ where, orderBy: { creadoEn: 'desc' }, take: 30 }),
    prisma.notificacion.count({ where: { ...where, creadoEn: { gt: usuario.notifVistasHasta } } }),
  ]);
  // A quién va dirigido cada aviso: al técnico asignado por nombre, o al área completa
  const ids = [...new Set(items.map(n => n.usuarioId).filter((x): x is number => x !== null))];
  const nombres = new Map((await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })).map(u => [u.id, u.nombre]));
  const destinatario = (n: { area: AreaNotificacion; usuarioId: number | null }) =>
    n.usuarioId !== null ? `Técnico: ${nombres.get(n.usuarioId) ?? 'asignado'}` : n.area === 'INVENTARIO' ? 'Inventario' : 'Servicios técnicos';
  return { items: items.map(n => ({ ...n, nueva: n.creadoEn > usuario.notifVistasHasta, destinatario: destinatario(n) })), noLeidas };
};

export const marcarLeidas = async (userId: number) => {
  await prisma.usuario.update({ where: { id: userId }, data: { notifVistasHasta: new Date() } });
};
