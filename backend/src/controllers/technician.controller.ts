import { Response } from 'express';
import { AuthRequest } from '../types';
import * as technicianService from '../services/technician.service';
import { responder } from '../utils/http';
import { auditar } from '../utils/auditoria';

export const getAll = (_req: AuthRequest, res: Response) =>
  responder(res, () => technicianService.getAll());

export const create = (req: AuthRequest, res: Response) => responder(res, async () => {
  const tecnico = await technicianService.create(req.body);
  auditar(req, { accion: 'create', seccion: 'tecnicos', entidad: 'usuario', entidadId: tecnico.id, descripcion: `Creó el técnico ${tecnico.nombre}` });
  return tecnico;
}, 201);

export const update = (req: AuthRequest, res: Response) => responder(res, async () => {
  const tecnico = await technicianService.update(Number(req.params.id), req.body);
  auditar(req, { accion: 'update', seccion: 'tecnicos', entidad: 'usuario', entidadId: tecnico.id, descripcion: `Modificó el técnico ${tecnico.nombre}${req.body.contrasena ? ' (cambió la contraseña)' : ''}` });
  return tecnico;
});

export const remove = (req: AuthRequest, res: Response) => responder(res, async () => {
  const tecnico = await technicianService.remove(Number(req.params.id));
  auditar(req, { accion: 'delete', seccion: 'tecnicos', entidad: 'usuario', entidadId: tecnico.id, descripcion: `Eliminó el técnico ${tecnico.nombre}` });
}, 204);
