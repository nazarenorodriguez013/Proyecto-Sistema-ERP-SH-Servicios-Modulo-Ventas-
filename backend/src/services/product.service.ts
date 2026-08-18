import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export const getAll = () =>
  prisma.producto.findMany({ include: { categoria: true } });

export const getById = (id: number) =>
  prisma.producto.findUniqueOrThrow({ where: { id }, include: { categoria: true } });

// Solo considera productos activos: uno descontinuado no debería disparar alertas de reposición
export const getLowStock = async () => {
  const productos = await prisma.producto.findMany({ where: { activo: true }, include: { categoria: true } });
  return productos.filter(p => p.stock <= p.stockMinimo);
};

// Genera un código incremental de 4 dígitos basado en el último código asignado
const generateCode = async (): Promise<string> => {
  const last = await prisma.producto.findFirst({
    where: { codigo: { not: null } },
    orderBy: { codigo: 'desc' },
  });
  if (!last?.codigo) return '0001';
  const next = parseInt(last.codigo, 10) + 1;
  return String(next).padStart(4, '0');
};

// Valida los campos antes de tocar la base; se comparte entre create y update
const validateNumericFields = (data: { nombre?: string; precio?: number; stock?: number; stockMinimo?: number }) => {
  if (data.nombre !== undefined && !data.nombre.trim()) throw new Error('El nombre del producto es obligatorio');
  if (data.precio !== undefined && data.precio <= 0) throw new Error('El precio debe ser mayor a 0');
  if (data.stock !== undefined && (data.stock < 0 || !Number.isInteger(data.stock))) throw new Error('El stock debe ser un número entero mayor o igual a 0');
  if (data.stockMinimo !== undefined && (data.stockMinimo < 0 || !Number.isInteger(data.stockMinimo))) throw new Error('El stock mínimo debe ser un número entero mayor o igual a 0');
};

export const create = async (data: {
  nombre: string;
  descripcion?: string;
  precioCosto?: number;
  precio: number;
  stock: number;
  stockMinimo?: number;
  categoriaId: number;
  activo?: boolean;
}) => {
  validateNumericFields(data);
  // El código se genera acá, no lo manda el cliente, para garantizar unicidad y orden
  const codigo = await generateCode();
  return prisma.producto.create({ data: { ...data, codigo }, include: { categoria: true } });
};

export const update = async (id: number, data: {
  nombre?: string;
  descripcion?: string;
  precioCosto?: number;
  precio?: number;
  stock?: number;
  stockMinimo?: number;
  categoriaId?: number;
  activo?: boolean;
}) => {
  validateNumericFields(data);
  const producto = await prisma.producto.update({ where: { id }, data, include: { categoria: true } });
  // Avisa por websocket en tiempo real si la edición dejó el producto en stock bajo
  if (producto.activo && producto.stock <= producto.stockMinimo) {
    getIO()?.emit('low-stock', producto);
  }
  return producto;
};

export const remove = (id: number) => prisma.producto.delete({ where: { id } });
