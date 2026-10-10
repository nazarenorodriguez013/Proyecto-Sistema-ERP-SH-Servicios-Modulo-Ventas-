import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const POR_PAGINA = 50;

export type FiltrosAuditoria = { q?: string; seccion?: string; accion?: string; usuario?: string; desde?: string; hasta?: string };

// "2026-10-09" -> inicio de ese día en hora local; "hasta" incluye el día completo
const fecha = (texto: string | undefined, finDelDia = false) => {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return undefined;
  const d = new Date(`${texto}T00:00:00`);
  if (finDelDia) d.setDate(d.getDate() + 1);
  return d;
};

export const filtro = (f: FiltrosAuditoria): Prisma.AuditoriaWhereInput => {
  const q = f.q?.trim();
  const desde = fecha(f.desde), hasta = fecha(f.hasta, true);
  return {
    ...(q ? { OR: [
      { descripcion: { contains: q, mode: 'insensitive' } },
      { usuarioNombre: { contains: q, mode: 'insensitive' } },
      { ip: { contains: q } },
    ] } : {}),
    ...(f.seccion ? { seccion: f.seccion } : {}),
    ...(f.accion ? { accion: f.accion } : {}),
    ...(f.usuario && Number(f.usuario) ? { usuarioId: Number(f.usuario) } : {}),
    ...(desde || hasta ? { creadoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {}),
  };
};

export const listar = async (f: FiltrosAuditoria, pagina: number) => {
  const where = filtro(f);
  const [total, eventos, secciones, acciones, usuarios] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({ where, orderBy: { id: 'desc' }, skip: (Math.max(1, pagina) - 1) * POR_PAGINA, take: POR_PAGINA }),
    // Opciones de los filtros: solo lo que efectivamente aparece en el registro
    prisma.auditoria.findMany({ distinct: ['seccion'], select: { seccion: true }, orderBy: { seccion: 'asc' } }),
    prisma.auditoria.findMany({ distinct: ['accion'], select: { accion: true }, orderBy: { accion: 'asc' } }),
    prisma.usuario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
  ]);
  return {
    total, pagina: Math.max(1, pagina), paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), eventos,
    secciones: secciones.map(s => s.seccion), acciones: acciones.map(a => a.accion), usuarios,
  };
};

// Todo lo filtrado, para exportar (hasta 5000 eventos, que es más que una semana de uso normal)
export const todos = (f: FiltrosAuditoria) =>
  prisma.auditoria.findMany({ where: filtro(f), orderBy: { id: 'desc' }, take: 5000 });
