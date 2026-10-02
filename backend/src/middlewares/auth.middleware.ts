import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

// Valida el token JWT del header "Authorization: Bearer <token>" y cuelga el usuario en req.user
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Token requerido' });
    return;
  }
  let payload: AuthRequest['user'];
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthRequest['user'];
  } catch {
    res.status(401).json({ message: 'Token inválido' });
    return;
  }
  // El token solo identifica a la persona: si la desactivaron o la borraron la sesión deja de servir en el acto,
  // y los permisos son siempre los del rol actual (no los que tenía al iniciar sesión)
  const usuario = await prisma.usuario.findUnique({ where: { id: payload!.id }, select: { id: true, correo: true, rol: true, activo: true } });
  if (!usuario?.activo) {
    res.status(401).json({ message: 'Sesión inválida. Volvé a iniciar sesión' });
    return;
  }
  req.user = { id: usuario.id, correo: usuario.correo, rol: usuario.rol };
  next();
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
