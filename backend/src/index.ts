import dotenv from 'dotenv';
dotenv.config();
// Carga también prisma/.env por si Prisma define ahí su propia DATABASE_URL
dotenv.config({ path: 'prisma/.env' });
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import saleRoutes from './routes/sale.routes';
import clientRoutes from './routes/client.routes';
import repairRoutes from './routes/repair.routes';
import technicianRoutes from './routes/technician.routes';
import userRoutes from './routes/user.routes';
import companyRoutes from './routes/company.routes';
import notificationRoutes from './routes/notification.routes';
import { setIO } from './socket';
import { seed } from './seed';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Detrás del proxy de Railway, así req.protocol es https y los links de los mails salen bien
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/users', userRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// En producción el mismo servidor sirve el build del frontend (no hace falta otro servicio aparte)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../..', 'frontend', 'dist');
  // El HTML nunca se cachea (así el navegador toma siempre los archivos nuevos tras un deploy)
  app.use(express.static(distPath, { index: false }));
  // Un archivo de /assets que ya no existe (pestaña abierta durante un deploy) tiene que dar 404:
  // si se respondiera con el HTML, el navegador intentaría ejecutarlo como JavaScript y la pantalla quedaría en negro
  app.use('/assets', (_req, res) => { res.status(404).end(); });
  app.use((_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Guarda la instancia para que los services puedan emitir eventos (ej. stock-actualizado) sin importar Express
setIO(io);

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
});

const PORT = process.env.PORT || 3000;

seed().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
}).catch(console.error);
