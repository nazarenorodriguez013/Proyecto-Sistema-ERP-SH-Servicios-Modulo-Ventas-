import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

// Instancia global de Socket.io; se inicializa una sola vez al arrancar el servidor
let io: Server;

// Adjunta Socket.io al servidor HTTP y registra conexiones/desconexiones
export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.on('disconnect', () => console.log('Cliente desconectado:', socket.id));
  });
};

// Retorna la instancia activa; lanza error si se llama antes de initSocket
export const getIO = () => {
  if (!io) throw new Error('Socket.io no inicializado');
  return io;
};
