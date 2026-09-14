import { Request, Response } from 'express';
import * as machineService from '../services/machine.service';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
  res.json(await machineService.getAll());
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await machineService.getById(Number(req.params.id)));
  } catch {
    res.status(404).json({ message: 'Máquina no encontrada' });
  }
};

// Usado por el dashboard para mostrar alertas de stock bajo de la flota
export const getLowStock = async (_req: Request, res: Response): Promise<void> => {
  res.json(await machineService.getLowStock());
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await machineService.create(req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await machineService.update(Number(req.params.id), req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await machineService.remove(Number(req.params.id));
    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Máquina no encontrada' });
  }
};
