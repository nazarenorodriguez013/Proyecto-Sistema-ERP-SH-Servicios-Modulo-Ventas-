import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { permisosDeRol } from '../utils/permisos';
import { auditar } from '../utils/auditoria';

const prisma = new PrismaClient();

// Valida el token JWT del header "Authorization: Bearer <token>" y cuelga el usuario en req.user
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Token requerido' });
    return;
  }
  let payload: { id: number };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
  } catch {
    res.status(401).json({ message: 'Token inválido' });
    return;
  }
  // El token solo identifica a la persona: si la desactivaron o la borraron la sesión deja de servir en el acto,
  // y los permisos son siempre los del rol actual (no los que tenía al iniciar sesión)
  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.id },
    select: { id: true, correo: true, nombre: true, activo: true, rol: { select: { slug: true, activo: true, permisos: { select: { permiso: true } } } } },
  });
  if (!usuario?.activo) {
    res.status(401).json({ message: 'Sesión inválida. Volvé a iniciar sesión' });
    return;
  }
  req.user = { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre, rolSlug: usuario.rol.slug, permisos: permisosDeRol(usuario.rol) };
  next();
};

// Deja pasar si el usuario tiene alguno de los permisos; si no, responde 403 y lo deja en la auditoría.
// Debe ir siempre después de authenticate, ya que depende de req.user
export const requierePermiso = (...permisos: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!permisos.some(p => req.user?.permisos.includes(p))) {
      auditar(req, { accion: 'access_denied', seccion: 'seguridad', descripcion: `Acceso denegado a ${req.method} ${req.baseUrl}${req.path}` });
      res.status(403).json({ message: 'No tenés permiso para esta acción' });
      return;
    }
    next();
  };
