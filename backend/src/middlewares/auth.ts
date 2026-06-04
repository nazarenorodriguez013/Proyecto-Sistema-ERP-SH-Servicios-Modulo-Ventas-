import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Extiende Request para que los controladores accedan al usuario autenticado
export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Verifica el token Bearer del header Authorization y adjunta userId/userRole al request
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Token no proporcionado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    // Token expirado o manipulado
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Bloquea el acceso a usuarios que no sean Admin
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'Admin') {
    res.status(403).json({ message: 'Solo administradores' });
    return;
  }
  next();
};
