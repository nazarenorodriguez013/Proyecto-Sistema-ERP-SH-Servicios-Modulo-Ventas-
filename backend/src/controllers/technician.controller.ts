import { Request, Response } from 'express';
import * as technicianService from '../services/technician.service';
import { responder } from '../utils/http';

export const getAll = (_req: Request, res: Response) =>
  responder(res, () => technicianService.getAll());

export const create = (req: Request, res: Response) =>
  responder(res, () => technicianService.create(req.body), 201);

export const update = (req: Request, res: Response) =>
  responder(res, () => technicianService.update(Number(req.params.id), req.body));

export const remove = (req: Request, res: Response) =>
  responder(res, () => technicianService.remove(Number(req.params.id)), 204);
