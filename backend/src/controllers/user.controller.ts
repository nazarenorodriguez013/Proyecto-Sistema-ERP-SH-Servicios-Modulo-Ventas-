import { Response } from 'express';
import { AuthRequest } from '../types';
import * as userService from '../services/user.service';
import { responder } from '../utils/http';

export const getAll = (_req: AuthRequest, res: Response) => responder(res, () => userService.getAll());
export const create = (req: AuthRequest, res: Response) => responder(res, () => userService.create(req.body), 201);
export const update = (req: AuthRequest, res: Response) =>
  responder(res, () => userService.update(Number(req.params.id), req.user!.id, req.body));
export const remove = (req: AuthRequest, res: Response) =>
  responder(res, () => userService.remove(Number(req.params.id), req.user!.id), 204);
