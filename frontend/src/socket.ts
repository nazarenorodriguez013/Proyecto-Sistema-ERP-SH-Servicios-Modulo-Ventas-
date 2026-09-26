import { io } from 'socket.io-client'
import { API_BASE } from './config'

// Una sola conexión compartida por todas las pantallas; sin VITE_API_URL se conecta al mismo origen (Vite la redirige al backend)
export const socket = io(API_BASE || undefined)
