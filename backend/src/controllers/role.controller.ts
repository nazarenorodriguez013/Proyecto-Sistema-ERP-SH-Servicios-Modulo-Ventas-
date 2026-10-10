import { Response } from 'express';
import { AuthRequest } from '../types';
import * as roleService from '../services/role.service';
import { responder } from '../utils/http';
import { auditar, diferencias } from '../utils/auditoria';

export const getAll = (_req: AuthRequest, res: Response) => responder(res, () => roleService.getAll());
export const getById = (req: AuthRequest, res: Response) => responder(res, () => roleService.getById(Number(req.params.id)));
export const catalogo = (_req: AuthRequest, res: Response) => responder(res, async () => roleService.catalogo());

export const create = (req: AuthRequest, res: Response) => responder(res, async () => {
  const rol = await roleService.create(req.body);
  auditar(req, { accion: 'create', seccion: 'roles', entidad: 'rol', entidadId: rol.id, descripcion: `Creó el rol ${rol.nombre} con ${rol.permisos.length} permiso(s)`, datos: { permisos: rol.permisos } });
  return rol;
}, 201);

export const update = (req: AuthRequest, res: Response) => responder(res, async () => {
  const id = Number(req.params.id);
  const antes = await roleService.getById(id);
  const rol = await roleService.update(id, req.user!, req.body);
  const cambios: Record<string, unknown> = diferencias(antes, rol, ['nombre', 'descripcion', 'activo']);
  const agregados = rol.permisos.filter(p => !antes.permisos.includes(p));
  const quitados = antes.permisos.filter(p => !rol.permisos.includes(p));
  if (agregados.length) cambios['permisos agregados'] = agregados.join(', ');
  if (quitados.length) cambios['permisos quitados'] = quitados.join(', ');
  if (Object.keys(cambios).length)
    auditar(req, {
      accion: agregados.length || quitados.length ? 'permissions_change' : 'update', seccion: 'roles', entidad: 'rol', entidadId: id,
      descripcion: `Modificó el rol ${rol.nombre}`, datos: cambios,
    });
  return rol;
});

export const remove = (req: AuthRequest, res: Response) => responder(res, async () => {
  const rol = await roleService.remove(Number(req.params.id));
  auditar(req, { accion: 'delete', seccion: 'roles', entidad: 'rol', entidadId: rol.id, descripcion: `Eliminó el rol ${rol.nombre}` });
}, 204);
