import { Response } from 'express';
import { AuthRequest } from '../types';
import * as categoryService from '../services/category.service';
import { mensajeSeguro } from '../utils/http';
import { auditar } from '../utils/auditoria';

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await categoryService.getAll());
};

// El frontend manda el nombre como "nombre" (ver schema Categoria), no "name"

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoria = await categoryService.create(req.body.nombre);
    auditar(req, { accion: 'create', seccion: 'categorias', entidad: 'categoria', entidadId: categoria.id, descripcion: `Creó la categoría ${categoria.nombre}` });
    res.status(201).json(categoria);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = (await categoryService.getAll()).find(c => c.id === id);
    const categoria = await categoryService.update(id, req.body.nombre);
    if (antes && antes.nombre !== categoria.nombre)
      auditar(req, { accion: 'update', seccion: 'categorias', entidad: 'categoria', entidadId: id, descripcion: `Renombró la categoría ${antes.nombre}`, datos: { nombre: { antes: antes.nombre, ahora: categoria.nombre } } });
    res.json(categoria);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = (await categoryService.getAll()).find(c => c.id === id);
    await categoryService.remove(id);
    auditar(req, { accion: 'delete', seccion: 'categorias', entidad: 'categoria', entidadId: id, descripcion: `Eliminó la categoría ${antes?.nombre ?? `#${id}`}` });
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
