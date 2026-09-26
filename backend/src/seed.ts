import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Solo siembra datos de ejemplo si la base está vacía (primer arranque), nunca pisa datos existentes
export async function seedIfEmpty() {
  const count = await prisma.usuario.count();
  if (count > 0) return;

  console.log('DB vacía, sembrando datos iniciales...');

  await prisma.usuario.createMany({
    data: [
      { nombre: 'Administrador', correo: 'admin@shservicios.com',    contrasena: await bcrypt.hash('admin123',    10), rol: 'ADMIN'    },
      { nombre: 'Vendedor',      correo: 'vendedor@shservicios.com', contrasena: await bcrypt.hash('vendedor123', 10), rol: 'VENDEDOR' },
    ],
  });

  await prisma.categoria.createMany({
    data: [
      { nombre: 'Elevadores y Levanta Autos' },
      { nombre: 'Equipos de Taller' },
      { nombre: 'Herramientas Neumaticas' },
    ],
  });
  const [cat1, cat2, cat3] = await prisma.categoria.findMany({ orderBy: { id: 'asc' } });

  await prisma.producto.createMany({
    data: [
      { codigo: '0002', nombre: 'Elevador Columna 2 Postes 4000 kg',  precio: 849400,  precioCosto: 620000,  stock: 1,   stockMinimo: 1, activo: true,  categoriaId: cat1.id },
      { codigo: '0003', nombre: 'Elevador 4 Columnas 5000 kg',        precio: 1290000, precioCosto: 980000,  stock: 193, stockMinimo: 1, activo: false, categoriaId: cat1.id },
      { codigo: '0004', nombre: 'Gato Hidraulico de Piso 3 Ton',      precio: 52000,   precioCosto: 38000,   stock: 99,  stockMinimo: 3, activo: true,  categoriaId: cat1.id },
      { codigo: '0005', nombre: 'Caballete Mecanico 3 Ton (par)',     precio: 21000,   precioCosto: 14500,   stock: 20,  stockMinimo: 4, activo: true,  categoriaId: cat1.id },
      { codigo: '0006', nombre: 'Compresor de Aire 100L 3 HP',        precio: 128000,  precioCosto: 95000,   stock: 5,   stockMinimo: 2, activo: true,  categoriaId: cat2.id },
      { codigo: '0007', nombre: 'Balanceadora de Ruedas Digital',     precio: 560000,  precioCosto: 420000,  stock: 0,   stockMinimo: 1, activo: true,  categoriaId: cat2.id },
      { codigo: '0008', nombre: 'Alineadora 3D Laser 4 Ruedas',       precio: 1650000, precioCosto: 1250000, stock: 1,   stockMinimo: 1, activo: true,  categoriaId: cat2.id },
      { codigo: '0009', nombre: 'Pistola de Impacto Neumatica 1/2"',  precio: 31500,   precioCosto: 22000,   stock: 12,  stockMinimo: 3, activo: true,  categoriaId: cat3.id },
      { codigo: '0010', nombre: 'Kit Inflador Digital de Neumaticos', precio: 13500,   precioCosto: 8500,    stock: 21,  stockMinimo: 5, activo: true,  categoriaId: cat3.id },
    ],
  });

  console.log('Seed completo: 2 usuarios, 3 categorías, 9 productos.');
}

// Permite ejecutarlo a mano con "npm run db:seed" o automáticamente tras "npm run db:reset"
if (require.main === module) {
  seedIfEmpty().catch(console.error).finally(() => prisma.$disconnect());
}
