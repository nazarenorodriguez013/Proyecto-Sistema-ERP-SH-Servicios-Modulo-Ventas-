import { Response } from 'express';
import { AuthRequest } from '../types';
import * as repairService from '../services/repair.service';

// Ejecuta la acción y responde con el código HTTP que trae el error (400 si no trae ninguno)
const responder = async (res: Response, accion: () => Promise<unknown>, status = 200) => {
  try {
    res.status(status).json(await accion());
  } catch (err: any) {
    res.status(err.status ?? 400).json({ message: err.message });
  }
};

export const getAll = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getAll(req.user!));

export const getById = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getById(Number(req.params.id), req.user!));

export const getTecnicos = (_req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getTecnicos());

export const create = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.create({ ...req.body, clienteId: Number(req.body.clienteId) }), 201);

export const responderPresupuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.responderPresupuesto(Number(req.params.id), !!req.body.aceptado));

export const asignarTecnico = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.asignarTecnico(Number(req.params.id), Number(req.body.tecnicoId)));

export const agregarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.agregarRepuesto(Number(req.params.id), Number(req.body.productoId), Number(req.body.cantidad), req.user!));

export const quitarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.quitarRepuesto(Number(req.params.id), Number(req.params.productoId), req.user!));

export const marcarReparado = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.marcarReparado(Number(req.params.id), req.user!));

export const entregar = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.entregar(Number(req.params.id), req.body.medioPago, req.body.proximoMantenimiento));
