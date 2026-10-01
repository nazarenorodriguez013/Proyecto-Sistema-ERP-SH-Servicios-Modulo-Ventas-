import { Request, Response } from 'express';
import * as companyService from '../services/company.service';
import { responder } from '../utils/http';

export const get = (_req: Request, res: Response) => responder(res, () => companyService.get());
export const update = (req: Request, res: Response) => responder(res, () => companyService.update(req.body));
