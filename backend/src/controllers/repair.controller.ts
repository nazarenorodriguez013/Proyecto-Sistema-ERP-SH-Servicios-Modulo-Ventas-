import { Response } from 'express';
import { AuthRequest } from '../types';
import * as repairService from '../services/repair.service';
import { responder } from '../utils/http';
import { auditar } from '../utils/auditoria';

const pesos = (n: number | null | undefined) => `$${(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export const getAll = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getAll(req.user!));

export const getById = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getById(Number(req.params.id), req.user!));

export const create = (req: AuthRequest, res: Response) => responder(res, async () => {
  const servicio = await repairService.create({
    ...req.body, clienteId: Number(req.body.clienteId), tecnicoId: req.body.tecnicoId ? Number(req.body.tecnicoId) : null,
  });
  auditar(req, { accion: 'create', seccion: 'servicios', entidad: 'servicio', entidadId: servicio.id, descripcion: `Registró el servicio #${servicio.id} · ${servicio.equipo} (${servicio.cliente.nombre})` });
  return servicio;
}, 201);

export const actualizar = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.actualizar(Number(req.params.id), req.body, req.user!));

export const asignarTecnico = (req: AuthRequest, res: Response) => responder(res, async () => {
  const servicio = await repairService.asignarTecnico(Number(req.params.id), Number(req.body.tecnicoId));
  auditar(req, { accion: 'update', seccion: 'servicios', entidad: 'servicio', entidadId: servicio.id, descripcion: `Asignó el servicio #${servicio.id} a ${servicio.tecnico?.nombre ?? 'un técnico'}` });
  return servicio;
});

export const presupuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.presupuesto({ ...req.body, clienteId: Number(req.body.clienteId) }), 201);

export const agregarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.agregarRepuesto(Number(req.params.id), Number(req.body.productoId), Number(req.body.cantidad), req.user!));

export const quitarRepuesto = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.quitarRepuesto(Number(req.params.id), Number(req.params.productoId), req.user!));

export const finalizar = (req: AuthRequest, res: Response) => responder(res, async () => {
  const servicio = await repairService.finalizar(Number(req.params.id), req.body, req.user!);
  auditar(req, { accion: 'update', seccion: 'servicios', entidad: 'servicio', entidadId: servicio.id, descripcion: `Finalizó el servicio #${servicio.id} · total ${pesos(servicio.total)}${servicio.medioPago ? ` (${servicio.medioPago})` : ''}` });
  return servicio;
});

export const remove = (req: AuthRequest, res: Response) => responder(res, async () => {
  const id = Number(req.params.id);
  await repairService.remove(id);
  auditar(req, { accion: 'delete', seccion: 'servicios', entidad: 'servicio', entidadId: id, descripcion: `Eliminó el servicio #${id}` });
}, 204);

export const getRetiros = (_req: AuthRequest, res: Response) =>
  responder(res, () => repairService.getRetiros());

export const marcarRetiro = (req: AuthRequest, res: Response) =>
  responder(res, () => repairService.marcarRetiro(Number(req.params.id), req.body.estado));
