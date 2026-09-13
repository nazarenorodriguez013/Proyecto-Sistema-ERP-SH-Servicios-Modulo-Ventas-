import { Request, Response } from 'express';
import * as clientService from '../services/client.service';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
  res.json(await clientService.getAll());
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await clientService.getById(Number(req.params.id)));
  } catch {
    res.status(404).json({ message: 'Cliente no encontrado' });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await clientService.create(req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await clientService.update(Number(req.params.id), req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await clientService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(err.message === 'Cliente no encontrado' ? 404 : 400).json({ message: err.message });
  }
};
