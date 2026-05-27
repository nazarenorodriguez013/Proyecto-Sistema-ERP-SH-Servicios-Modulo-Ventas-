import { Response } from 'express';
import { AuthRequest } from '../types';
import * as saleService from '../services/sale.service';

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user!.id;
    const { items, medioPago, montoRecibido } = req.body;
    if (!items || !items.length) {
      res.status(400).json({ message: 'El comprobante no tiene productos' });
      return;
    }
    const venta = await saleService.createSale(usuarioId, items, medioPago ?? 'Efectivo', montoRecibido ?? null);
    res.status(201).json(venta);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await saleService.getAll());
};
