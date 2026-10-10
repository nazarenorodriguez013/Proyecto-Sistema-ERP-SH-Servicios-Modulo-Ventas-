import { Response } from 'express';
import { AuthRequest } from '../types';
import * as auditService from '../services/audit.service';
import { responder } from '../utils/http';

const filtros = (q: AuthRequest['query']): auditService.FiltrosAuditoria => ({
  q: String(q.q ?? ''), seccion: String(q.seccion ?? ''), accion: String(q.accion ?? ''),
  usuario: String(q.usuario ?? ''), desde: String(q.desde ?? ''), hasta: String(q.hasta ?? ''),
});

export const listar = (req: AuthRequest, res: Response) =>
  responder(res, () => auditService.listar(filtros(req.query), Number(req.query.pagina) || 1));
