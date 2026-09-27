import { PrismaClient, EstadoServicio } from '@prisma/client';
import { getIO } from '../socket';
import { httpError } from '../utils/http';

const prisma = new PrismaClient();

const MEDIO_CUENTA_CORRIENTE = 'Cuenta Corriente';

const includeServicio = {
  cliente: true,
  tecnico: { select: { id: true, nombre: true } },
  repuestos: { include: { producto: true } },
};

type Usuario = { id: number; rol: string };

// Avisa a todas las pantallas; si cambiaron repuestos, también al inventario
const notificar = (stock = false) => {
  getIO()?.emit('servicios-actualizados');
  if (stock) getIO()?.emit('stock-actualizado');
};

// Trae el servicio verificando el estado esperado y, si es técnico, que esté asignado a él
const obtener = async (id: number, estados: EstadoServicio[], usuario?: Usuario) => {
  const servicio = await prisma.servicioTecnico.findUnique({ where: { id } });
  if (!servicio) throw httpError(404, 'Servicio no encontrado');
  if (usuario?.rol === 'TECNICO' && servicio.tecnicoId !== usuario.id)
    throw httpError(403, 'El servicio está asignado a otro técnico');
  if (!estados.includes(servicio.estado)) throw httpError(409, 'La acción no corresponde al estado actual del servicio');
  return servicio;
};

// Mano de obra más repuestos; si el equipo está en garantía no se le cobra al cliente
const calcularCostoTotal = (servicio: {
  enGarantia: boolean; costoManoObra: number; repuestos: { cantidad: number; precioUnitario: number }[];
}) => servicio.enGarantia
  ? 0
  : servicio.costoManoObra + servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0);

// El técnico solo ve los servicios que tiene asignados
export const getAll = (usuario: Usuario) =>
  prisma.servicioTecnico.findMany({
    where: usuario.rol === 'TECNICO' ? { tecnicoId: usuario.id } : {},
    include: includeServicio,
    orderBy: { fechaIngreso: 'desc' },
  });

export const getById = async (id: number, usuario: Usuario) => {
  const servicio = await prisma.servicioTecnico.findUnique({ where: { id }, include: includeServicio });
  if (!servicio) throw httpError(404, 'Servicio no encontrado');
  if (usuario.rol === 'TECNICO' && servicio.tecnicoId !== usuario.id)
    throw httpError(403, 'El servicio está asignado a otro técnico');
  return servicio;
};

export const create = async (data: {
  clienteId: number; equipo: string; descripcionFalla: string; repuestosSolicitados?: string | null;
  enGarantia?: boolean; costoManoObra?: number;
}) => {
  if (!data.equipo?.trim()) throw httpError(400, 'El equipo es obligatorio');
  if (!data.descripcionFalla?.trim()) throw httpError(400, 'La descripción de la falla es obligatoria');
  const costoManoObra = data.enGarantia ? 0 : Number(data.costoManoObra) || 0;
  if (!data.enGarantia && costoManoObra <= 0) throw httpError(400, 'El presupuesto de mano de obra debe ser mayor a 0');
  if (!(await prisma.cliente.findUnique({ where: { id: data.clienteId } }))) throw httpError(400, 'Cliente no encontrado');

  const servicio = await prisma.servicioTecnico.create({
    data: {
      clienteId: data.clienteId,
      equipo: data.equipo.trim(),
      descripcionFalla: data.descripcionFalla.trim(),
      repuestosSolicitados: data.repuestosSolicitados?.trim() || null,
      enGarantia: !!data.enGarantia,
      costoManoObra,
      estado: data.enGarantia ? 'PENDIENTE' : 'PRESUPUESTADO',
    },
    include: includeServicio,
  });
  notificar();
  return servicio;
};

export const responderPresupuesto = async (id: number, aceptado: boolean) => {
  await obtener(id, ['PRESUPUESTADO']);
  const servicio = await prisma.servicioTecnico.update({
    where: { id },
    data: { estado: aceptado ? 'PENDIENTE' : 'RECHAZADO' },
    include: includeServicio,
  });
  notificar();
  return servicio;
};

// Asignar el técnico inicia la reparación; mientras está en curso se puede reasignar
export const asignarTecnico = async (id: number, tecnicoId: number) => {
  await obtener(id, ['PENDIENTE', 'EN_REPARACION']);
  const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
  if (tecnico?.rol !== 'TECNICO') throw httpError(400, 'El usuario seleccionado no es técnico');
  const servicio = await prisma.servicioTecnico.update({
    where: { id },
    data: { tecnicoId, estado: 'EN_REPARACION' },
    include: includeServicio,
  });
  notificar();
  return servicio;
};

// Regla k: los repuestos se descuentan del stock al salir del depósito, o sea al cargarlos al servicio
export const agregarRepuesto = async (id: number, productoId: number, cantidad: number, usuario: Usuario) => {
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw httpError(400, 'La cantidad debe ser un número entero mayor a 0');
  await obtener(id, ['EN_REPARACION'], usuario);

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto?.activo) throw httpError(400, 'Repuesto no disponible');
    const { count } = await tx.producto.updateMany({
      where: { id: productoId, stock: { gte: cantidad } },
      data: { stock: { decrement: cantidad } },
    });
    if (count === 0) throw httpError(400, `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);

    await tx.servicioRepuesto.upsert({
      where: { servicioId_productoId: { servicioId: id, productoId } },
      create: { servicioId: id, productoId, cantidad, precioUnitario: producto.precio },
      update: { cantidad: { increment: cantidad } },
    });
  });
  notificar(true);
  return getById(id, usuario);
};

// Si el técnico devuelve un repuesto, vuelve completo al stock
export const quitarRepuesto = async (id: number, productoId: number, usuario: Usuario) => {
  await obtener(id, ['EN_REPARACION'], usuario);
  await prisma.$transaction(async (tx) => {
    const repuesto = await tx.servicioRepuesto.findUnique({ where: { servicioId_productoId: { servicioId: id, productoId } } });
    if (!repuesto) throw httpError(404, 'El repuesto no está cargado en el servicio');
    await tx.servicioRepuesto.delete({ where: { id: repuesto.id } });
    await tx.producto.update({ where: { id: productoId }, data: { stock: { increment: repuesto.cantidad } } });
  });
  notificar(true);
  return getById(id, usuario);
};

export const marcarReparado = async (id: number, usuario: Usuario) => {
  await obtener(id, ['EN_REPARACION'], usuario);
  const servicio = await prisma.servicioTecnico.update({ where: { id }, data: { estado: 'REPARADO' }, include: includeServicio });
  notificar();
  return servicio;
};

// Entrega del equipo: se registra el cobro y, si es a cuenta corriente, la deuda del cliente
export const entregar = async (id: number, medioPago: string, proximoMantenimiento?: string | null) => {
  if (!medioPago) throw httpError(400, 'Seleccioná el medio de pago');
  const fechaMantenimiento = proximoMantenimiento ? new Date(proximoMantenimiento) : null;
  if (fechaMantenimiento && isNaN(fechaMantenimiento.getTime())) throw httpError(400, 'La fecha de próximo mantenimiento no es válida');
  await obtener(id, ['REPARADO']);

  const servicio = await prisma.$transaction(async (tx) => {
    const actual = await tx.servicioTecnico.findUniqueOrThrow({ where: { id }, include: { repuestos: true } });
    const total = calcularCostoTotal(actual);
    const entregado = await tx.servicioTecnico.update({
      where: { id },
      data: { estado: 'ENTREGADO', medioPago, total, proximoMantenimiento: fechaMantenimiento, entregadoEn: new Date() },
      include: includeServicio,
    });
    if (medioPago === MEDIO_CUENTA_CORRIENTE && total > 0) {
      await tx.movimientoCuenta.create({
        data: { clienteId: actual.clienteId, tipo: 'SERVICIO', concepto: `Servicio técnico #${id}`, monto: total, servicioId: id },
      });
    }
    return entregado;
  });
  notificar();
  return servicio;
};
