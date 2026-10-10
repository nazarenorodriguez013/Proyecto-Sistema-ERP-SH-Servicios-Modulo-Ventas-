import { Response } from 'express';
import { AuthRequest } from '../types';
import * as userService from '../services/user.service';
import { responder } from '../utils/http';
import { auditar, diferencias } from '../utils/auditoria';

const CAMPOS_AUDITADOS = ['nombre', 'correo', 'rol', 'telefono', 'puesto', 'activo', 'debeCambiarContrasena', 'dosPasos'];
const paraAuditar = (u: { rol: { nombre: string } } & Record<string, unknown>) => ({ ...u, rol: u.rol.nombre });

export const getAll = (_req: AuthRequest, res: Response) => responder(res, () => userService.getAll());

export const create = (req: AuthRequest, res: Response) => responder(res, async () => {
  const usuario = await userService.create(req.body, req.user!);
  auditar(req, { accion: 'create', seccion: 'usuarios', entidad: 'usuario', entidadId: usuario.id, descripcion: `Creó el usuario ${usuario.nombre} (${usuario.rol.nombre})` });
  return usuario;
}, 201);

export const update = (req: AuthRequest, res: Response) => responder(res, async () => {
  const id = Number(req.params.id);
  const antes = await userService.obtener(id);
  const usuario = await userService.update(id, req.user!, req.body);
  const cambios = antes ? diferencias(paraAuditar(antes), paraAuditar(usuario), CAMPOS_AUDITADOS) : {};
  if (req.body.contrasena) cambios.contrasena = { antes: '••••', ahora: 'cambiada' };
  if (req.body.desbloquear === true) cambios.bloqueo = { antes: 'bloqueado', ahora: 'desbloqueado' };
  // Desactivar desde el menú es una baja; cualquier otro cambio, una modificación
  const accion = antes?.activo && !usuario.activo ? 'deactivate' : 'update';
  if (Object.keys(cambios).length)
    auditar(req, { accion, seccion: 'usuarios', entidad: 'usuario', entidadId: id, descripcion: `${accion === 'deactivate' ? 'Desactivó' : 'Modificó'} el usuario ${usuario.nombre}`, datos: cambios });
  return usuario;
});

export const remove = (req: AuthRequest, res: Response) => responder(res, async () => {
  const usuario = await userService.remove(Number(req.params.id), req.user!);
  auditar(req, { accion: 'delete', seccion: 'usuarios', entidad: 'usuario', entidadId: usuario.id, descripcion: `Eliminó definitivamente el usuario ${usuario.nombre} (${usuario.correo})` });
}, 204);
