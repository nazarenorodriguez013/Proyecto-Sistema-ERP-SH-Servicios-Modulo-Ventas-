import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('admin123', 10);
  const vendedorPass = await bcrypt.hash('vendedor123', 10);

  await prisma.usuario.upsert({
    where: { correo: 'admin@shservicios.com' },
    update: {},
    create: { nombre: 'Administrador', correo: 'admin@shservicios.com', contrasena: adminPass, rol: 'ADMIN' },
  });

  await prisma.usuario.upsert({
    where: { correo: 'vendedor@shservicios.com' },
    update: {},
    create: { nombre: 'Vendedor', correo: 'vendedor@shservicios.com', contrasena: vendedorPass, rol: 'VENDEDOR' },
  });

  console.log('Usuarios creados correctamente');
}

main().catch(console.error).finally(() => prisma.$disconnect());
