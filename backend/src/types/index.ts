import { Request } from 'express';

// Extiende Request para que TypeScript reconozca req.user, agregado por el middleware authenticate
export interface AuthRequest extends Request {
  user?: {
    id: number;
    correo: string;
    rol: string;
  };
}
