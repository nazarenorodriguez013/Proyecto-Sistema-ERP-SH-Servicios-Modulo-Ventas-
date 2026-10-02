import { Response } from 'express';
import { AuthRequest } from '../types';
import * as notificationService from '../services/notification.service';
import { responder } from '../utils/http';

export const listar = (req: AuthRequest, res: Response) => responder(res, () => notificationService.listar(req.user!.id));
export const marcarLeidas = (req: AuthRequest, res: Response) =>
  responder(res, async () => { await notificationService.marcarLeidas(req.user!.id); return { ok: true }; });
