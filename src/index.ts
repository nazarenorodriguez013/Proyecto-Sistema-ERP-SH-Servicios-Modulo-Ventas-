import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'prisma/.env' });
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import saleRoutes from './routes/sale.routes';
import { setIO } from './socket';

const prisma = new PrismaClient();

async function seedIfEmpty() {
  const count = await prisma.usuario.count();
  if (count === 0) {
    console.log('DB vacía, sembrando usuarios iniciales...');
    await prisma.usuario.createMany({
      data: [
        { nombre: 'Administrador', correo: 'admin@shservicios.com', contrasena: await bcrypt.hash('admin123', 10), rol: 'ADMIN' },
        { nombre: 'Vendedor',      correo: 'vendedor@shservicios.com', contrasena: await bcrypt.hash('vendedor123', 10), rol: 'VENDEDOR' },
      ],
    });
    console.log('Usuarios creados: admin@shservicios.com / admin123');
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

setIO(io);

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
});

const PORT = process.env.PORT || 3000;

seedIfEmpty().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
}).catch(console.error);
