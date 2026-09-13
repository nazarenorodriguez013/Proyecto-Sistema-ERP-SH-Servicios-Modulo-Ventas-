import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export const getAll = () => prisma.maquina.findMany();

export const getById = (id: number) =>
  prisma.maquina.findUniqueOrThrow({ where: { id } });

// Solo considera máquinas activas: una dada de baja no debería disparar alertas de reposición
export const getLowStock = async () => {
  const maquinas = await prisma.maquina.findMany({ where: { activo: true } });
  return maquinas.filter(m => m.stock <= m.stockMinimo);
};

// Genera un código incremental de 4 dígitos basado en el último código asignado
const generateCode = async (): Promise<string> => {
  const last = await prisma.maquina.findFirst({
    where: { codigo: { not: null } },
    orderBy: { codigo: 'desc' },
  });
  if (!last?.codigo) return '0001';
  const next = parseInt(last.codigo, 10) + 1;
  return String(next).padStart(4, '0');
};

// Valida los campos antes de tocar la base; se comparte entre create y update
const validateNumericFields = (data: { nombre?: string; tarifaDiaria?: number; stock?: number; stockMinimo?: number }) => {
  if (data.nombre !== undefined && !data.nombre.trim()) throw new Error('El nombre de la máquina es obligatorio');
  if (data.tarifaDiaria !== undefined && data.tarifaDiaria <= 0) throw new Error('La tarifa diaria debe ser mayor a 0');
  if (data.stock !== undefined && (data.stock < 0 || !Number.isInteger(data.stock))) throw new Error('El stock debe ser un número entero mayor o igual a 0');
  if (data.stockMinimo !== undefined && (data.stockMinimo < 0 || !Number.isInteger(data.stockMinimo))) throw new Error('El stock mínimo debe ser un número entero mayor o igual a 0');
};

export const create = async (data: {
  nombre: string;
  marca?: string;
  tipo?: string;
  tarifaDiaria: number;
  stock: number;
  stockMinimo?: number;
  activo?: boolean;
}) => {
  validateNumericFields(data);
  // El código se genera acá, no lo manda el cliente, para garantizar unicidad y orden
  const codigo = await generateCode();
  return prisma.maquina.create({ data: { ...data, codigo } });
};

export const update = async (id: number, data: {
  nombre?: string;
  marca?: string;
  tipo?: string;
  tarifaDiaria?: number;
  stock?: number;
  stockMinimo?: number;
  activo?: boolean;
}) => {
  validateNumericFields(data);
  const maquina = await prisma.maquina.update({ where: { id }, data });
  // Avisa por websocket en tiempo real si la edición dejó la máquina en stock bajo
  if (maquina.activo && maquina.stock <= maquina.stockMinimo) {
    getIO()?.emit('low-stock-maquina', maquina);
  }
  return maquina;
};

export const remove = (id: number) => prisma.maquina.delete({ where: { id } });
