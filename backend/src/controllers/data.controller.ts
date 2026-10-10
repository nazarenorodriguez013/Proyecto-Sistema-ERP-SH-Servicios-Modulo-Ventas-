import { Response } from 'express';
import { AuthRequest } from '../types';
import * as importService from '../services/import.service';
import * as exportService from '../services/export.service';
import { responder } from '../utils/http';
import { auditar } from '../utils/auditoria';

// Importar: el archivo llega como texto (el navegador ya lo decodificó, sea UTF-8 o Windows-1252)
export const previsualizar = (req: AuthRequest, res: Response) =>
  responder(res, () => importService.previsualizar(String(req.body.tipo ?? ''), req.body.contenido, req.body.cotizacion));

export const importar = (req: AuthRequest, res: Response) => responder(res, async () => {
  const r = await importService.importar(String(req.body.tipo ?? ''), req.body.contenido, req.body.actualizar !== false, req.body.cotizacion);
  auditar(req, {
    accion: 'import', seccion: 'importar',
    descripcion: `Importó ${req.body.tipo}${req.body.nombreArchivo ? ` desde ${String(req.body.nombreArchivo).slice(0, 80)}` : ''}: ${r.creados} nuevo(s), ${r.actualizados} actualizado(s), ${r.omitidos} omitido(s)`,
    datos: r,
  });
  return r;
});

export const exportar = (req: AuthRequest, res: Response) => responder(res, async () => {
  const tabla = await exportService.obtener(String(req.params.dataset), req.user!.permisos);
  auditar(req, { accion: 'export', seccion: 'exportar', descripcion: `Exportó ${tabla.titulo} (${tabla.filas.length} fila(s))` });
  return tabla;
});
