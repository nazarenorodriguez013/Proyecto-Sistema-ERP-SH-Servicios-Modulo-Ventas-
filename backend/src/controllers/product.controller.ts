import { Request, Response } from 'express';
import * as productService from '../services/product.service';

// Devuelve todos los productos con su categoría incluida
export const getAll = async (_req: Request, res: Response): Promise<void> => {
  const products = await productService.getAll();
  res.json(products);
};

// Busca un producto por ID; 404 si no existe
export const getById = async (req: Request, res: Response): Promise<void> => {
  const product = await productService.getById(Number(req.params.id));
  if (!product) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
  res.json(product);
};

// Crea un producto nuevo (solo admins)
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await productService.create(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Actualiza campos del producto (solo admins)
export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await productService.update(Number(req.params.id), req.body);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Elimina un producto por ID (solo admins)
export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await productService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
