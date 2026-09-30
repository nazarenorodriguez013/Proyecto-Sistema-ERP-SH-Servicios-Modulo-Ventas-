import { PrismaClient, EstadoServicio, EstadoRetiro, TipoComprobante } from '@prisma/client';
import { getIO } from '../socket';
import { httpError } from '../utils/http';
import { registrarCargo } from './movement.service';

const prisma = new PrismaClient();

const includeServicio = {
  cliente: true,
  tecnico: { select: { id: true, nombre: true } },
  repuestos: { include: { producto: true } },
};

type Usuario = { id: number; rol: string };
type RepuestoInput = { productoId: number; cantidad: number };

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

const validarDatos = (data: { equipo?: string; descripcionFalla?: string; enGarantia?: boolean; costoManoObra?: number }) => {
  if (!data.equipo?.trim()) throw httpError(400, 'El equipo es obligatorio');
  if (!data.descripcionFalla?.trim()) throw httpError(400, 'La descripción de la falla es obligatoria');
  const costoManoObra = data.enGarantia ? 0 : Number(data.costoManoObra) || 0;
  if (!data.enGarantia && costoManoObra <= 0) throw httpError(400, 'El presupuesto de mano de obra debe ser mayor a 0');
  return costoManoObra;
};

const parseFecha = (fecha?: string | null) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) throw httpError(400, 'La fecha ingresada no es válida');
  return d;
};

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
  clienteId: number; tecnicoId: number; equipo: string; descripcionFalla: string; tareas?: string | null;
  enGarantia?: boolean; costoManoObra?: number; fechaEstimadaFin?: string | null; repuestos?: RepuestoInput[];
}) => {
  const costoManoObra = validarDatos(data);
  if (!data.tecnicoId) throw httpError(400, 'Asigná un técnico para el servicio');
  const fechaEstimadaFin = parseFecha(data.fechaEstimadaFin);
  if (!(await prisma.cliente.findUnique({ where: { id: data.clienteId } }))) throw httpError(400, 'Cliente no encontrado');
  const tecnico = await prisma.usuario.findUnique({ where: { id: data.tecnicoId } });
  if (tecnico?.rol !== 'TECNICO') throw httpError(400, 'El usuario seleccionado no es técnico');

  const repuestos = data.repuestos ?? [];
  const hayRepuestos = repuestos.length > 0;

  const servicio = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.servicioTecnico.create({
      data: {
        clienteId: data.clienteId,
        tecnicoId: data.tecnicoId,
        equipo: data.equipo.trim(),
        descripcionFalla: data.descripcionFalla.trim(),
        tareas: data.tareas?.trim() || null,
        enGarantia: !!data.enGarantia,
        costoManoObra,
        fechaEstimadaFin,
        estado: 'EN_CURSO',
        estadoRetiro: hayRepuestos ? 'PENDIENTE' : null,
      },
    });

    for (const item of repuestos) {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0)
        throw httpError(400, 'La cantidad de cada repuesto debe ser un número entero mayor a 0');
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto?.activo) throw httpError(400, 'Repuesto no disponible');
      const { count } = await tx.producto.updateMany({
        where: { id: item.productoId, stock: { gte: item.cantidad } },
        data: { stock: { decrement: item.cantidad } },
      });
      if (count === 0) throw httpError(400, `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);
      await tx.servicioRepuesto.create({
        data: { servicioId: nuevo.id, productoId: item.productoId, cantidad: item.cantidad, precioUnitario: producto.precio },
      });
    }

    // El código de retiro identifica al servicio en la cola del depósito de repuestos
    if (hayRepuestos) {
      await tx.servicioTecnico.update({ where: { id: nuevo.id }, data: { codigoRetiro: `RT-${String(nuevo.id).padStart(6, '0')}` } });
    }

    return tx.servicioTecnico.findUniqueOrThrow({ where: { id: nuevo.id }, include: includeServicio });
  });

  notificar(hayRepuestos);
  return servicio;
};

// Solo calcula y devuelve una vista previa para imprimir: no se guarda nada ni se toca el stock
export const presupuesto = async (data: {
  clienteId: number; tecnicoId?: number | null; equipo: string; descripcionFalla: string; tareas?: string | null;
  enGarantia?: boolean; costoManoObra?: number; repuestos?: RepuestoInput[];
}) => {
  const costoManoObra = validarDatos(data);
  const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } });
  if (!cliente) throw httpError(400, 'Cliente no encontrado');
  const tecnico = data.tecnicoId ? await prisma.usuario.findUnique({ where: { id: data.tecnicoId } }) : null;

  const repuestos = [];
  for (const item of data.repuestos ?? []) {
    const producto = await prisma.producto.findUnique({ where: { id: item.productoId } });
    if (!producto) throw httpError(400, 'Producto no encontrado');
    repuestos.push({ id: 0, cantidad: item.cantidad, precioUnitario: producto.precio, producto });
  }

  return {
    id: null, equipo: data.equipo.trim(), descripcionFalla: data.descripcionFalla.trim(), tareas: data.tareas?.trim() || null,
    enGarantia: !!data.enGarantia, costoManoObra, estado: 'EN_CURSO' as const, fechaEstimadaFin: null,
    tipoComprobante: null, medioPago: null, total: calcularCostoTotal({ enGarantia: !!data.enGarantia, costoManoObra, repuestos }),
    saldoAplicado: 0, proximoMantenimiento: null, codigoRetiro: null, estadoRetiro: null,
    fechaIngreso: new Date(), finalizadoEn: null, cliente, tecnico, repuestos,
  };
};

// Regla: los repuestos se descuentan del stock al salir del depósito, o sea al cargarlos al servicio
export const agregarRepuesto = async (id: number, productoId: number, cantidad: number, usuario: Usuario) => {
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw httpError(400, 'La cantidad debe ser un número entero mayor a 0');
  await obtener(id, ['EN_CURSO'], usuario);

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

    // Si es el primer repuesto que se carga, arranca la cola de retiro recién ahora
    const servicio = await tx.servicioTecnico.findUniqueOrThrow({ where: { id } });
    if (!servicio.estadoRetiro) {
      await tx.servicioTecnico.update({
        where: { id },
        data: { estadoRetiro: 'PENDIENTE', codigoRetiro: servicio.codigoRetiro ?? `RT-${String(id).padStart(6, '0')}` },
      });
    }
  });
  notificar(true);
  return getById(id, usuario);
};

// Si el técnico devuelve un repuesto, vuelve completo al stock
export const quitarRepuesto = async (id: number, productoId: number, usuario: Usuario) => {
  await obtener(id, ['EN_CURSO'], usuario);
  await prisma.$transaction(async (tx) => {
    const repuesto = await tx.servicioRepuesto.findUnique({ where: { servicioId_productoId: { servicioId: id, productoId } } });
    if (!repuesto) throw httpError(404, 'El repuesto no está cargado en el servicio');
    await tx.servicioRepuesto.delete({ where: { id: repuesto.id } });
    await tx.producto.update({ where: { id: productoId }, data: { stock: { increment: repuesto.cantidad } } });
  });
  notificar(true);
  return getById(id, usuario);
};

// Cierra el servicio: recién ahora se genera el comprobante y se cobra (antes era solo un estimado)
export const finalizar = async (id: number, data: {
  tipoComprobante: TipoComprobante; medioPago: string; costoManoObra?: number;
  proximoMantenimiento?: string | null; usarSaldo?: boolean;
}) => {
  if (!['FACTURA', 'REMITO'].includes(data.tipoComprobante)) throw httpError(400, 'Tipo de comprobante inválido');
  if (!data.medioPago) throw httpError(400, 'Seleccioná el medio de pago');
  const fechaMantenimiento = parseFecha(data.proximoMantenimiento);
  await obtener(id, ['EN_CURSO']);

  const servicio = await prisma.$transaction(async (tx) => {
    if (data.costoManoObra !== undefined) {
      await tx.servicioTecnico.update({ where: { id }, data: { costoManoObra: Number(data.costoManoObra) || 0 } });
    }
    const actual = await tx.servicioTecnico.findUniqueOrThrow({ where: { id }, include: { repuestos: true } });
    const total = calcularCostoTotal(actual);
    // El cobro pasa por la cuenta corriente del cliente, que descuenta primero el saldo a favor
    const saldoAplicado = await registrarCargo(tx, {
      clienteId: actual.clienteId, tipo: 'SERVICIO', concepto: `Servicio técnico #${id}`, total,
      medioPago: data.medioPago, usarSaldo: data.usarSaldo !== false, servicioId: id,
    });
    return tx.servicioTecnico.update({
      where: { id },
      data: {
        estado: 'FINALIZADO', tipoComprobante: data.tipoComprobante, medioPago: data.medioPago, total, saldoAplicado,
        proximoMantenimiento: fechaMantenimiento, finalizadoEn: new Date(),
      },
      include: includeServicio,
    });
  });
  notificar();
  return servicio;
};

// Cola del depósito: todo servicio que tiene repuestos para retirar, para la pantalla de administración de repuestos
export const getRetiros = () =>
  prisma.servicioTecnico.findMany({
    where: { estadoRetiro: { not: null } },
    include: includeServicio,
    orderBy: { fechaIngreso: 'desc' },
  });

const SIGUIENTE_ESTADO_RETIRO: Record<EstadoRetiro, EstadoRetiro | null> = {
  PENDIENTE: 'LISTO', LISTO: 'RETIRADO', RETIRADO: null,
};

export const marcarRetiro = async (id: number, estado: EstadoRetiro) => {
  const servicio = await prisma.servicioTecnico.findUnique({ where: { id } });
  if (!servicio) throw httpError(404, 'Servicio no encontrado');
  if (!servicio.estadoRetiro) throw httpError(409, 'Este servicio no tiene repuestos para retirar');
  if (SIGUIENTE_ESTADO_RETIRO[servicio.estadoRetiro] !== estado)
    throw httpError(409, `No se puede pasar de "${servicio.estadoRetiro}" a "${estado}"`);
  const actualizado = await prisma.servicioTecnico.update({ where: { id }, data: { estadoRetiro: estado }, include: includeServicio });
  notificar();
  return actualizado;
};
