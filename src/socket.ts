import { Server } from 'socket.io';

// Variable de módulo: guarda la única instancia de Socket.io para que cualquier
// service pueda emitir eventos sin tener que pasarla como parámetro en cada función
let _io: Server;

export const setIO = (io: Server) => { _io = io; };
export const getIO = () => _io;
