import { Request, Response } from 'express';
import * as productService from '../services/product.service';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
  res.json(await productService.getAll());
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await productService.getById(Number(req.params.id)));
  } catch {
    res.status(404).json({ message: 'Producto no encontrado' });
  }
};

// Usado por el dashboard para mostrar alertas de stock bajo
export const getLowStock = async (_req: Request, res: Response): Promise<void> => {
  res.json(await productService.getLowStock());
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await productService.create(req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await productService.update(Number(req.params.id), req.body));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await productService.remove(Number(req.params.id));
    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Producto no encontrado' });
  }
};
