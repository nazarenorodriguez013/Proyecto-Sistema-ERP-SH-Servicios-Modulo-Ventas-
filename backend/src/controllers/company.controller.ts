import { Response } from 'express';
import { AuthRequest } from '../types';
import * as companyService from '../services/company.service';
import { responder } from '../utils/http';
import { auditar, diferencias } from '../utils/auditoria';

export const get = (_req: AuthRequest, res: Response) => responder(res, () => companyService.get());

export const update = (req: AuthRequest, res: Response) => responder(res, async () => {
  const antes = await companyService.get();
  const empresa = await companyService.update(req.body);
  const cambios = diferencias(antes, empresa, Object.keys(empresa).filter(k => k !== 'id'));
  if (Object.keys(cambios).length)
    auditar(req, { accion: 'settings_change', seccion: 'configuracion', descripcion: 'Modificó los datos de la empresa', datos: cambios });
  return empresa;
});
