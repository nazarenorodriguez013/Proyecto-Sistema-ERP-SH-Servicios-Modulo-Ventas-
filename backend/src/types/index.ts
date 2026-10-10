import { Request } from 'express';

// Extiende Request para que TypeScript reconozca req.user, agregado por el middleware authenticate
export interface AuthRequest extends Request {
  user?: {
    id: number;
    correo: string;
    nombre: string;
    rolSlug: string;
    // Permisos efectivos del rol del usuario (ver utils/permisos.ts)
    permisos: string[];
  };
}
