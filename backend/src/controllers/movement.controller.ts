import { Request, Response } from 'express';
import * as movementService from '../services/movement.service';

// Desde la cuenta del cliente solo se registran pagos: las deudas las genera el punto de venta
export const createPago = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await movementService.createPago(Number(req.params.id), Number(req.body.monto)));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await movementService.remove(Number(req.params.movementId));
    res.status(204).send();
  } catch (err: any) {
    res.status(err.message === 'Movimiento no encontrado' ? 404 : 400).json({ message: err.message });
  }
};
