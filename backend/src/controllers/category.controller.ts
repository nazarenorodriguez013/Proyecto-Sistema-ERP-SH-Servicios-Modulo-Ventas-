import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';

// Devuelve todas las categorías ordenadas alfabéticamente
export const getAll = async (_req: Request, res: Response): Promise<void> => {
  const categories = await categoryService.getAll();
  res.json(categories);
};

// Crea una nueva categoría (solo admins pueden llamar este endpoint)
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await categoryService.create(req.body.name);
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
