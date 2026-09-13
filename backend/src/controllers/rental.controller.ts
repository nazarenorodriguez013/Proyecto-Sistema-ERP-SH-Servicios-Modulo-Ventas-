import { Response } from 'express';
import { AuthRequest } from '../types';
import * as rentalService from '../services/rental.service';

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await rentalService.getAll());
};

// Registra el alquiler a nombre del usuario logueado (sale del token, no del body)
export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user!.id;
    const alquiler = await rentalService.create(usuarioId, req.body);
    res.status(201).json(alquiler);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const updateEstado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alquiler = await rentalService.updateEstado(Number(req.params.id), req.body.estado);
    res.json(alquiler);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
