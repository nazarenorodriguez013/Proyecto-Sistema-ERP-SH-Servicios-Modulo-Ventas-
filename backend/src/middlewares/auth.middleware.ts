import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

// Valida el token JWT del header "Authorization: Bearer <token>" y cuelga el usuario en req.user
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Token requerido' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthRequest['user'];
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Debe ir siempre después de authenticate, ya que depende de req.user
export const authorizeRoles = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user?.rol ?? '')) {
      res.status(403).json({ message: 'No tenés permiso para esta acción' });
      return;
    }
    next();
  };

export const authorizeAdmin = authorizeRoles('ADMIN');

// Ventas, clientes y cobros son tareas de administración: el técnico solo trabaja en el taller
// El depósito: administrador y rol Inventario manejan artículos, categorías y stock
export const authorizeInventario = authorizeRoles('ADMIN', 'INVENTARIO');

export const authorizeAdministracion = authorizeRoles('ADMIN', 'VENDEDOR');
