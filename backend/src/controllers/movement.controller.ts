import { Request, Response } from 'express';
import * as movementService from '../services/movement.service';

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const clienteId = Number(req.params.id);
    const { tipo, concepto, monto } = req.body;
    res.status(201).json(await movementService.create(clienteId, tipo, concepto, Number(monto)));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await movementService.remove(Number(req.params.movementId));
    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Movimiento no encontrado' });
  }
};
