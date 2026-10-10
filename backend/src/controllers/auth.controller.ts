import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { responder, urlBase } from '../utils/http';
import { auditar } from '../utils/auditoria';

const ipDe = (req: Request) => (req.ip ?? '').replace(/^::ffff:/, '') || null;

// Deja en la auditoría los ingresos y los intentos fallidos (con el correo que se probó)
const conAuditoria = async (req: Request, intento: string, accion: () => Promise<any>) => {
  try {
    const r = await accion();
    if (r?.user) auditar(req, { accion: 'login', seccion: 'acceso', descripcion: `Ingresó al sistema${intento ? ` (${intento})` : ''}`, usuario: { id: r.user.id, nombre: r.user.nombre } });
    return r;
  } catch (err: any) {
    auditar(req, { accion: 'login_failed', seccion: 'acceso', descripcion: `Intento de ingreso fallido${intento ? ` (${intento})` : ''}: ${err.message}`.slice(0, 255), usuario: null });
    throw err;
  }
};

export const login = (req: Request, res: Response) =>
  responder(res, () => conAuditoria(req, String(req.body.correo ?? '').slice(0, 120), () => authService.login(req.body.correo, req.body.contrasena, ipDe(req))));

export const config = (_req: Request, res: Response) => responder(res, async () => authService.config());

export const loginGoogle = (req: Request, res: Response) =>
  responder(res, () => conAuditoria(req, 'con Google', () => authService.loginGoogle(req.body.credential, ipDe(req))));

export const sesionActual = (req: AuthRequest, res: Response) =>
  responder(res, () => authService.sesionActual(req.user!.id));

export const actualizarCuenta = (req: AuthRequest, res: Response) =>
  responder(res, () => authService.actualizarCuenta(req.user!.id, req.body));

// El link del mail apunta al mismo sitio desde el que se pidió, salvo que APP_URL diga otra cosa
export const olvideContrasena = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.olvideContrasena(req.body.correo, urlBase(req));
    return { message: 'Si el correo está registrado, te enviamos un link para recuperar la contraseña' };
  });

export const verificarDosPasos = (req: Request, res: Response) =>
  responder(res, () => conAuditoria(req, 'verificación en dos pasos', () => authService.verificarDosPasos(req.body.desafio, req.body.codigo, ipDe(req))));

export const reenviarCodigo = (req: Request, res: Response) =>
  responder(res, async () => { await authService.reenviarCodigo(req.body.desafio); return { message: 'Te enviamos un código nuevo' }; });

export const solicitarActivacion = (req: AuthRequest, res: Response) =>
  responder(res, async () => { await authService.solicitarActivacion(req.user!.id); return { message: 'Te enviamos un código por mail' }; });

export const confirmarActivacion = (req: AuthRequest, res: Response) =>
  responder(res, () => authService.confirmarActivacion(req.user!.id, req.body.codigo));

export const desactivarDosPasos = (req: AuthRequest, res: Response) =>
  responder(res, () => authService.desactivarDosPasos(req.user!.id, req.body.contrasenaActual));

export const restablecerContrasena = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.restablecerContrasena(req.body.token, req.body.contrasena);
    return { message: 'Contraseña actualizada. Ya podés iniciar sesión' };
  });
