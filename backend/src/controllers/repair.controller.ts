import { Response } from 'express';
import { AuthRequest } from '../types';
import * as repairService from '../services/repair.service';
import { responder } from '../utils/http';

export const getAll = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getAll(req.user!));

export const getById = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getById(Number(req.params.id), req.user!));

export const create = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.create({
    ...req.body, clienteId: Number(req.body.clienteId), tecnicoId: req.body.tecnicoId ? Number(req.body.tecnicoId) : null,
  }), 201);

export const asignarTecnico = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.asignarTecnico(Number(req.params.id), Number(req.body.tecnicoId)));

export const presupuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.presupuesto({ ...req.body, clienteId: Number(req.body.clienteId) }), 201);

export const agregarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.agregarRepuesto(Number(req.params.id), Number(req.body.productoId), Number(req.body.cantidad), req.user!));

export const quitarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.quitarRepuesto(Number(req.params.id), Number(req.params.productoId), req.user!));

export const finalizar = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.finalizar(Number(req.params.id), req.body));

export const getRetiros = (_req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getRetiros());

export const marcarRetiro = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.marcarRetiro(Number(req.params.id), req.body.estado));
