import { Response } from 'express';
import { AuthRequest } from '../types';
import * as productService from '../services/product.service';
import { mensajeSeguro } from '../utils/http';
import { auditar, diferencias } from '../utils/auditoria';

const seccion = (p: { tipoProducto: string }) => p.tipoProducto === 'MAQUINARIA' ? 'maquinaria' : 'repuestos';
const CAMPOS = ['nombre', 'descripcion', 'tipoProducto', 'categoria', 'precioCosto', 'precio', 'stock', 'stockMinimo', 'activo'];
const paraAuditar = (p: { categoria: { nombre: string } } & Record<string, unknown>) => ({ ...p, categoria: p.categoria.nombre });

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await productService.getAll());
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await productService.getById(Number(req.params.id)));
  } catch {
    res.status(404).json({ message: 'Producto no encontrado' });
  }
};

// Usado por el dashboard para mostrar alertas de stock bajo
export const getLowStock = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await productService.getLowStock());
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const producto = await productService.create(req.body);
    auditar(req, { accion: 'create', seccion: seccion(producto), entidad: 'producto', entidadId: producto.id, descripcion: `Creó ${producto.codigo} · ${producto.nombre}` });
    res.status(201).json(producto);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = await productService.getById(id).catch(() => null);
    const producto = await productService.update(id, req.body);
    const cambios = antes ? diferencias(paraAuditar(antes), paraAuditar(producto), CAMPOS) : {};
    if (Object.keys(cambios).length) {
      // Los cambios de precio se destacan aparte en la auditoría (como en el catálogo)
      const accion = 'precio' in cambios || 'precioCosto' in cambios ? 'price_change' : 'update';
      auditar(req, { accion, seccion: seccion(producto), entidad: 'producto', entidadId: id, descripcion: `Modificó ${producto.codigo} · ${producto.nombre}`, datos: cambios });
    }
    res.json(producto);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const antes = await productService.getById(id).catch(() => null);
    await productService.remove(id);
    if (antes) auditar(req, { accion: 'delete', seccion: seccion(antes), entidad: 'producto', entidadId: id, descripcion: `Eliminó ${antes.codigo} · ${antes.nombre}` });
    res.status(204).send();
  } catch (err: any) {
    // P2025: no existe el producto; cualquier otro error es porque tiene ventas o servicios registrados
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }
    res.status(409).json({ message: mensajeSeguro(err) });
  }
};
