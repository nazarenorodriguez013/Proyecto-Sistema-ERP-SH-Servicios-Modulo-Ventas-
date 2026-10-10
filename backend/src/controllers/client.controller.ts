import { Response } from 'express';
import { AuthRequest } from '../types';
import * as clientService from '../services/client.service';
import { mensajeSeguro } from '../utils/http';
import { auditar, diferencias } from '../utils/auditoria';

const CAMPOS = ['nombre', 'documento', 'condicionIva', 'telefono', 'email', 'direccion'];

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await clientService.getAll());
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await clientService.getById(Number(req.params.id)));
  } catch {
    res.status(404).json({ message: 'Cliente no encontrado' });
  }
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cliente = await clientService.create(req.body);
    auditar(req, { accion: 'create', seccion: 'clientes', entidad: 'cliente', entidadId: cliente.id, descripcion: `Creó el cliente ${cliente.nombre}` });
    res.status(201).json(cliente);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = await clientService.getById(id).catch(() => null);
    const cliente = await clientService.update(id, req.body);
    const cambios = antes ? diferencias(antes, cliente, CAMPOS) : {};
    if (Object.keys(cambios).length)
      auditar(req, { accion: 'update', seccion: 'clientes', entidad: 'cliente', entidadId: id, descripcion: `Modificó el cliente ${cliente.nombre}`, datos: cambios });
    res.json(cliente);
  } catch (err: any) {
    res.status(err.message === 'Cliente no encontrado' ? 404 : 400).json({ message: mensajeSeguro(err) });
  }
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = await clientService.getById(id).catch(() => null);
    await clientService.remove(id);
    auditar(req, { accion: 'delete', seccion: 'clientes', entidad: 'cliente', entidadId: id, descripcion: `Eliminó el cliente ${antes?.nombre ?? `#${id}`}` });
    res.status(204).send();
  } catch (err: any) {
    res.status(err.message === 'Cliente no encontrado' ? 404 : 409).json({ message: mensajeSeguro(err) });
  }
};
