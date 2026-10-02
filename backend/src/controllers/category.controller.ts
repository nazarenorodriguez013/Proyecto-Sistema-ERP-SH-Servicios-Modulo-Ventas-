import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import { mensajeSeguro } from '../utils/http';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
  res.json(await categoryService.getAll());
};

// El frontend manda el nombre como "nombre" (ver schema Categoria), no "name"

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await categoryService.create(req.body.nombre));
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await categoryService.update(Number(req.params.id), req.body.nombre));
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await categoryService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    // P2025: no existe la categoría; cualquier otro error es porque tiene productos asignados
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Categoría no encontrada' });
      return;
    }
    res.status(409).json({ message: mensajeSeguro(err) });
  }
};
