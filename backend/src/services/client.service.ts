import { PrismaClient, Prisma } from '@prisma/client';
import { calcularSaldo } from './movement.service';

const prisma = new PrismaClient();

interface ClienteData {
  nombre?: string;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  condicionIva?: string;
}

// Traduce errores conocidos de Prisma a mensajes legibles para el usuario
const traducirError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw new Error('Ya existe un cliente con ese documento');
    if (err.code === 'P2025') throw new Error('Cliente no encontrado');
  }
  throw err;
};

const validar = (data: ClienteData) => {
  if (data.nombre !== undefined && (typeof data.nombre !== 'string' || !data.nombre.trim())) throw new Error('El nombre del cliente es obligatorio');
};

export const getAll = async () => {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: 'asc' },
    include: { movimientos: { select: { tipo: true, monto: true } } },
  });
  return clientes.map(({ movimientos, ...cliente }) => ({ ...cliente, saldo: calcularSaldo(movimientos) }));
};

// Ficha completa: datos, compras con sus productos, servicios técnicos con sus repuestos y movimientos de la cuenta corriente
export const getById = async (id: number) => {
  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id },
    include: {
      ventas: { include: { detallesVenta: { include: { producto: true } }, usuario: { select: { nombre: true } } }, orderBy: { creadoEn: 'desc' } },
      servicios: { include: { repuestos: { include: { producto: true } }, tecnico: { select: { id: true, nombre: true } } }, orderBy: { fechaIngreso: 'desc' } },
      movimientos: { orderBy: { creadoEn: 'desc' } },
    },
  });
  return { ...cliente, saldo: calcularSaldo(cliente.movimientos) };
};

export const create = async (data: ClienteData & { nombre: string }) => {
  validar(data);
  return prisma.cliente.create({ data }).catch(traducirError);
};

export const update = async (id: number, data: ClienteData) => {
  validar(data);
  return prisma.cliente.update({ where: { id }, data }).catch(traducirError);
};

export const remove = async (id: number) => {
  const [ventas, movimientos, servicios] = await Promise.all([
    prisma.venta.count({ where: { clienteId: id } }),
    prisma.movimientoCuenta.count({ where: { clienteId: id } }),
    prisma.servicioTecnico.count({ where: { clienteId: id } }),
  ]);
  if (ventas || movimientos || servicios)
    throw new Error('No se puede eliminar: el cliente tiene compras, pagos o servicios registrados');
  await prisma.cliente.delete({ where: { id } }).catch(traducirError);
};
