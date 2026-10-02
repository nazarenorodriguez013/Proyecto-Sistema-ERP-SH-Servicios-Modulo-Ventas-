import { PrismaClient, Prisma, EstadoServicio, EstadoRetiro, TipoComprobante } from '@prisma/client';
import { getIO } from '../socket';
import { httpError } from '../utils/http';
import { registrarCargo } from './movement.service';
import { siguienteNumero } from './correlativo.service';
import * as notificaciones from './notification.service';

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

const codigoDeRetiro = (id: number) => `RT-${String(id).padStart(6, '0')}`;
const detalleRepuestos = (items: { cantidad: number; producto: { nombre: string } }[]) =>
  items.map(r => `${r.cantidad} × ${r.producto.nombre}`).join(', ');

// Lo que realmente se puede prometer de un repuesto: el stock menos lo que otros servicios ya pidieron y todavía no retiraron.
// El stock se descuenta recién cuando el depósito entrega el repuesto.
const validarRepuesto = async (tx: Prisma.TransactionClient, productoId: number, cantidad: number) => {
  // Bloquea el producto hasta que termine la transacción: sin esto, dos pedidos simultáneos ven el mismo stock libre y reservan la misma unidad
  await tx.$queryRaw`SELECT id FROM productos WHERE id = ${productoId} FOR UPDATE`;
  const [producto, pedidos] = await Promise.all([
    tx.producto.findUnique({ where: { id: productoId } }),
    tx.servicioRepuesto.findMany({ where: { productoId }, select: { cantidad: true, cantidadRetirada: true } }),
  ]);
  if (!producto?.activo) throw httpError(400, 'Repuesto no disponible');
  if (producto.tipoProducto !== 'REPUESTO') throw httpError(400, `"${producto.nombre}" es maquinaria, no un repuesto`);
  const disponible = producto.stock - pedidos.reduce((sum, r) => sum + r.cantidad - r.cantidadRetirada, 0);
  if (disponible < cantidad) throw httpError(400, `Stock insuficiente para "${producto.nombre}" (disponible: ${Math.max(disponible, 0)})`);
  return producto;
};

// Después de agregar o quitar repuestos, la cola de retiro vuelve al estado que corresponde
const recalcularRetiro = async (tx: Prisma.TransactionClient, id: number) => {
  const [servicio, items] = await Promise.all([
    tx.servicioTecnico.findUniqueOrThrow({ where: { id } }),
    tx.servicioRepuesto.findMany({ where: { servicioId: id } }),
  ]);
  let estadoRetiro: EstadoRetiro | null;
  if (items.length === 0) estadoRetiro = null;
  else if (items.every(i => i.cantidadRetirada >= i.cantidad)) estadoRetiro = 'RETIRADO';
  else estadoRetiro = servicio.estadoRetiro === 'LISTO' ? 'LISTO' : 'PENDIENTE';
  await tx.servicioTecnico.update({
    where: { id },
    data: { estadoRetiro, codigoRetiro: estadoRetiro ? servicio.codigoRetiro ?? codigoDeRetiro(id) : servicio.codigoRetiro },
  });
  return { estadoRetiro, anterior: servicio.estadoRetiro };
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

// El costo de mano de obra es solo un estimado inicial: la solicitud rápida desde Ventas no tiene por qué traerlo
const validarDatos = (data: { equipo?: string; descripcionFalla?: string; enGarantia?: boolean; costoManoObra?: number }) => {
  if (!data.equipo?.trim()) throw httpError(400, 'El equipo es obligatorio');
  if (!data.descripcionFalla?.trim()) throw httpError(400, 'La descripción de la falla es obligatoria');
  return data.enGarantia ? 0 : Number(data.costoManoObra) || 0;
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
  clienteId: number; tecnicoId?: number | null; equipo: string; descripcionFalla: string; tareas?: string | null;
  enGarantia?: boolean; costoManoObra?: number; fechaEstimadaFin?: string | null; repuestos?: RepuestoInput[];
}) => {
  const costoManoObra = validarDatos(data);
  const fechaEstimadaFin = parseFecha(data.fechaEstimadaFin);
  if (!(await prisma.cliente.findUnique({ where: { id: data.clienteId } }))) throw httpError(400, 'Cliente no encontrado');
  // Sin técnico queda como solicitud pendiente de asignar (por ejemplo, la que llega desde el punto de venta)
  if (data.tecnicoId) {
    const tecnico = await prisma.usuario.findUnique({ where: { id: data.tecnicoId } });
    if (tecnico?.rol !== 'TECNICO') throw httpError(400, 'El usuario seleccionado no es técnico');
  }

  const repuestos = data.repuestos ?? [];
  const hayRepuestos = repuestos.length > 0;

  const servicio = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.servicioTecnico.create({
      data: {
        clienteId: data.clienteId,
        tecnicoId: data.tecnicoId || null,
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

    // Siempre en el mismo orden, así dos pedidos con los mismos repuestos no se traban entre sí
    for (const item of [...repuestos].sort((a, b) => a.productoId - b.productoId)) {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0)
        throw httpError(400, 'La cantidad de cada repuesto debe ser un número entero mayor a 0');
      const producto = await validarRepuesto(tx, item.productoId, item.cantidad);
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

  notificar();
  if (hayRepuestos)
    await notificaciones.crear({
      area: 'INVENTARIO', servicioId: servicio.id, titulo: 'Solicitud de repuestos',
      mensaje: `${servicio.codigoRetiro} · ${servicio.equipo} (${servicio.cliente.nombre}): ${detalleRepuestos(servicio.repuestos)}`,
    });
  if (!servicio.tecnicoId)
    await notificaciones.crear({ area: 'SERVICIOS', servicioId: servicio.id, titulo: 'Servicio sin técnico', mensaje: `#${servicio.id} · ${servicio.equipo} (${servicio.cliente.nombre}) espera que le asignen un técnico` });
  else
    await notificaciones.crear({ area: 'SERVICIOS', usuarioId: servicio.tecnicoId, servicioId: servicio.id, titulo: 'Servicio asignado', mensaje: `#${servicio.id} · ${servicio.equipo} (${servicio.cliente.nombre})` });
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

  const numero = await siguienteNumero('PRESUPUESTO');
  return {
    id: null, numero, equipo: data.equipo.trim(), descripcionFalla: data.descripcionFalla.trim(), tareas: data.tareas?.trim() || null,
    enGarantia: !!data.enGarantia, costoManoObra, estado: 'EN_CURSO' as const, fechaEstimadaFin: null,
    tipoComprobante: null, medioPago: null, total: calcularCostoTotal({ enGarantia: !!data.enGarantia, costoManoObra, repuestos }),
    saldoAplicado: 0, proximoMantenimiento: null, codigoRetiro: null, estadoRetiro: null,
    fechaIngreso: new Date(), finalizadoEn: null, cliente, tecnico, repuestos,
  };
};

// Asigna o reasigna el técnico de una solicitud (por ejemplo, la que llegó sin técnico desde el punto de venta)
export const asignarTecnico = async (id: number, tecnicoId: number) => {
  await obtener(id, ['EN_CURSO']);
  const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
  if (tecnico?.rol !== 'TECNICO') throw httpError(400, 'El usuario seleccionado no es técnico');
  const servicio = await prisma.servicioTecnico.update({ where: { id }, data: { tecnicoId }, include: includeServicio });
  notificar();
  await notificaciones.crear({ area: 'SERVICIOS', usuarioId: tecnicoId, servicioId: id, titulo: 'Servicio asignado', mensaje: `#${id} · ${servicio.equipo} (${servicio.cliente.nombre})` });
  return servicio;
};

// El técnico (o administración) ajusta el servicio mientras está en curso: mano de obra, fecha estimada y sus notas
export const actualizar = async (id: number, data: {
  costoManoObra?: number; fechaEstimadaFin?: string | null; diagnostico?: string | null; trabajoRealizado?: string | null;
}, usuario: Usuario) => {
  await obtener(id, ['EN_CURSO'], usuario);
  const cambios: Prisma.ServicioTecnicoUpdateInput = {};
  if (data.costoManoObra !== undefined) {
    const costo = Number(data.costoManoObra);
    if (!Number.isFinite(costo) || costo < 0) throw httpError(400, 'La mano de obra debe ser un número mayor o igual a 0');
    cambios.costoManoObra = costo;
  }
  if (data.fechaEstimadaFin !== undefined) cambios.fechaEstimadaFin = parseFecha(data.fechaEstimadaFin);
  if (data.diagnostico !== undefined) cambios.diagnostico = data.diagnostico?.trim() || null;
  if (data.trabajoRealizado !== undefined) cambios.trabajoRealizado = data.trabajoRealizado?.trim() || null;
  await prisma.servicioTecnico.update({ where: { id }, data: cambios });
  notificar();
  return getById(id, usuario);
};

// Agregar un repuesto lo suma al pedido del depósito: el stock se descuenta cuando lo retiran
export const agregarRepuesto = async (id: number, productoId: number, cantidad: number, usuario: Usuario) => {
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw httpError(400, 'La cantidad debe ser un número entero mayor a 0');
  await obtener(id, ['EN_CURSO'], usuario);

  const producto = await prisma.$transaction(async (tx) => {
    const producto = await validarRepuesto(tx, productoId, cantidad);
    await tx.servicioRepuesto.upsert({
      where: { servicioId_productoId: { servicioId: id, productoId } },
      create: { servicioId: id, productoId, cantidad, precioUnitario: producto.precio },
      update: { cantidad: { increment: cantidad } },
    });
    await recalcularRetiro(tx, id);
    return producto;
  });
  notificar();
  const servicio = await getById(id, usuario);
  await notificaciones.crear({
    area: 'INVENTARIO', servicioId: id, titulo: 'Repuestos agregados a un pedido',
    mensaje: `${servicio.codigoRetiro} · ${servicio.equipo}: ${cantidad} × ${producto.nombre}`,
  });
  return servicio;
};

// Si el repuesto ya se había retirado, al quitarlo vuelve al stock; si todavía no, simplemente se saca del pedido
export const quitarRepuesto = async (id: number, productoId: number, usuario: Usuario) => {
  await obtener(id, ['EN_CURSO'], usuario);
  const devuelto = await prisma.$transaction(async (tx) => {
    const repuesto = await tx.servicioRepuesto.findUnique({ where: { servicioId_productoId: { servicioId: id, productoId } } });
    if (!repuesto) throw httpError(404, 'El repuesto no está cargado en el servicio');
    await tx.servicioRepuesto.delete({ where: { id: repuesto.id } });
    if (repuesto.cantidadRetirada > 0)
      await tx.producto.update({ where: { id: productoId }, data: { stock: { increment: repuesto.cantidadRetirada } } });
    await recalcularRetiro(tx, id);
    return repuesto.cantidadRetirada > 0;
  });
  notificar(devuelto);
  return getById(id, usuario);
};

// Cierra el servicio: recién ahora se genera el comprobante y se cobra (antes era solo un estimado)
export const finalizar = async (id: number, data: {
  tipoComprobante: TipoComprobante; medioPago: string; costoManoObra?: number;
  proximoMantenimiento?: string | null; usarSaldo?: boolean; diagnostico?: string | null; trabajoRealizado?: string | null;
}, usuario: Usuario) => {
  if (!['FACTURA', 'REMITO'].includes(data.tipoComprobante)) throw httpError(400, 'Tipo de comprobante inválido');
  if (!data.medioPago) throw httpError(400, 'Seleccioná el medio de pago');
  const fechaMantenimiento = parseFecha(data.proximoMantenimiento);
  await obtener(id, ['EN_CURSO'], usuario);
  const items = await prisma.servicioRepuesto.findMany({ where: { servicioId: id } });
  if (items.some(i => i.cantidadRetirada < i.cantidad))
    throw httpError(409, 'Hay repuestos que todavía no se retiraron del depósito: retiralos o quitalos del servicio antes de finalizar');

  const servicio = await prisma.$transaction(async (tx) => {
    // Lo último que cargó el técnico (mano de obra y notas) se guarda junto con el cierre
    await tx.servicioTecnico.update({ where: { id }, data: {
      ...(data.costoManoObra !== undefined ? { costoManoObra: Number(data.costoManoObra) || 0 } : {}),
      ...(data.diagnostico !== undefined ? { diagnostico: data.diagnostico?.trim() || null } : {}),
      ...(data.trabajoRealizado !== undefined ? { trabajoRealizado: data.trabajoRealizado?.trim() || null } : {}),
    } });
    const actual = await tx.servicioTecnico.findUniqueOrThrow({ where: { id }, include: { repuestos: true } });
    const total = calcularCostoTotal(actual);
    // El cobro pasa por la cuenta corriente del cliente, que descuenta primero el saldo a favor
    const saldoAplicado = await registrarCargo(tx, {
      clienteId: actual.clienteId, tipo: 'SERVICIO', concepto: `Servicio técnico #${id}`, total,
      medioPago: data.medioPago, usarSaldo: data.usarSaldo !== false, servicioId: id,
    });
    const numero = await siguienteNumero(data.tipoComprobante, tx);
    return tx.servicioTecnico.update({
      where: { id },
      data: {
        estado: 'FINALIZADO', tipoComprobante: data.tipoComprobante, numero, medioPago: data.medioPago, total, saldoAplicado,
        proximoMantenimiento: fechaMantenimiento, finalizadoEn: new Date(),
      },
      include: includeServicio,
    });
  });
  notificar();
  // Si lo cerró el técnico, administración se entera para ver el comprobante
  if (usuario.rol === 'TECNICO')
    await notificaciones.crear({ area: 'SERVICIOS', servicioId: id, titulo: 'Servicio finalizado', mensaje: `#${id} · ${servicio.equipo} (${servicio.cliente.nombre}) lo finalizó ${servicio.tecnico?.nombre ?? 'el técnico'}` });
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

// Elimina el servicio completo: devuelve al depósito los repuestos que tenía cargados y saca la
// deuda que había generado en la cuenta del cliente, igual que al borrar un comprobante de venta
export const remove = async (id: number) => {
  await prisma.$transaction(async (tx) => {
    const servicio = await tx.servicioTecnico.findUnique({ where: { id }, include: { repuestos: true } });
    if (!servicio) throw httpError(404, 'Servicio no encontrado');

    for (const r of servicio.repuestos) {
      if (r.cantidadRetirada > 0)
        await tx.producto.update({ where: { id: r.productoId }, data: { stock: { increment: r.cantidadRetirada } } });
    }

    await tx.movimientoCuenta.deleteMany({ where: { servicioId: id } });
    await tx.servicioRepuesto.deleteMany({ where: { servicioId: id } });
    await tx.servicioTecnico.delete({ where: { id } });
  });
  notificar(true);
};

// El depósito avanza el pedido: PENDIENTE -> LISTO (avisa a Servicios Técnicos) -> RETIRADO (descuenta el stock)
export const marcarRetiro = async (id: number, estado: EstadoRetiro) => {
  const servicio = await prisma.servicioTecnico.findUnique({ where: { id }, include: { repuestos: { include: { producto: true } } } });
  if (!servicio) throw httpError(404, 'Servicio no encontrado');
  if (!servicio.estadoRetiro) throw httpError(409, 'Este servicio no tiene repuestos para retirar');
  if (SIGUIENTE_ESTADO_RETIRO[servicio.estadoRetiro] !== estado)
    throw httpError(409, `No se puede pasar de "${servicio.estadoRetiro}" a "${estado}"`);

  const actualizado = await prisma.$transaction(async (tx) => {
    if (estado === 'RETIRADO') {
      for (const r of servicio.repuestos) {
        const pendiente = r.cantidad - r.cantidadRetirada;
        if (pendiente <= 0) continue;
        // Descuenta solo si alcanza el stock en ese momento, así nunca queda negativo
        const { count } = await tx.producto.updateMany({ where: { id: r.productoId, stock: { gte: pendiente } }, data: { stock: { decrement: pendiente } } });
        if (count === 0)
          throw httpError(400, `Stock insuficiente para "${r.producto.nombre}" (hay ${r.producto.stock}, se necesitan ${pendiente}). Ajustá el stock antes de entregarlo`);
        await tx.servicioRepuesto.update({ where: { id: r.id }, data: { cantidadRetirada: r.cantidad } });
      }
    }
    return tx.servicioTecnico.update({ where: { id }, data: { estadoRetiro: estado }, include: includeServicio });
  });

  notificar(estado === 'RETIRADO');
  if (estado === 'LISTO')
    await notificaciones.crear({
      area: 'SERVICIOS', usuarioId: servicio.tecnicoId, servicioId: id, titulo: 'Repuestos listos para retirar',
      mensaje: `${servicio.codigoRetiro} · ${servicio.equipo}: ya están preparados en el depósito`,
    });
  if (estado === 'RETIRADO')
    await notificaciones.crear({
      area: 'INVENTARIO', servicioId: id, titulo: 'Retiro confirmado',
      mensaje: `${servicio.codigoRetiro} · ${servicio.equipo}: se descontó el stock`,
    });
  return actualizado;
};
