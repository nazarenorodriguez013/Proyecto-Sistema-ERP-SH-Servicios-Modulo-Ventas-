import { Response } from 'express';
import { AuthRequest } from '../types';
import * as userService from '../services/user.service';
import * as confirmacionService from '../services/confirmacion.service';
import { responder, urlBase } from '../utils/http';

export const getAll = (_req: AuthRequest, res: Response) => responder(res, () => userService.getAll());
export const create = (req: AuthRequest, res: Response) => responder(res, () => userService.create(req.body, urlBase(req)), 201);
export const update = (req: AuthRequest, res: Response) =>
  responder(res, () => userService.update(Number(req.params.id), req.user!.id, urlBase(req), req.body));
export const reenviarConfirmacion = (req: AuthRequest, res: Response) =>
  responder(res, async () => { await confirmacionService.reenviarConfirmacion(Number(req.params.id), urlBase(req)); return { message: 'Te mandamos el mail de confirmación' }; });
export const remove = (req: AuthRequest, res: Response) =>
  responder(res, () => userService.remove(Number(req.params.id), req.user!.id), 204);
