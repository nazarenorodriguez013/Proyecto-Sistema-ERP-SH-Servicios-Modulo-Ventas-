import { Request, Response } from 'express';
import * as saleService from '../services/sale.service';
import { AuthRequest } from '../middlewares/auth';

// Registra una venta; el userId viene del JWT decodificado por el middleware
export const createSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await saleService.createSale(req.userId!, req.body.items);
    res.status(201).json(sale);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Devuelve todas las ventas con detalle de productos y vendedor
export const getAll = async (_req: Request, res: Response): Promise<void> => {
  const sales = await saleService.getAll();
  res.json(sales);
};
