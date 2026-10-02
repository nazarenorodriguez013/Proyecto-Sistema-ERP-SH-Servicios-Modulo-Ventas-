import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { responder, urlBase } from '../utils/http';

export const login = (req: Request, res: Response) =>
  responder(res, () => authService.login(req.body.correo, req.body.contrasena));

export const config = (_req: Request, res: Response) => responder(res, async () => authService.config());

export const loginGoogle = (req: Request, res: Response) =>
  responder(res, () => authService.loginGoogle(req.body.credential));

export const actualizarCuenta = (req: AuthRequest, res: Response) =>
  responder(res, () => authService.actualizarCuenta(req.user!.id, req.body));

// El link del mail apunta al mismo sitio desde el que se pidió, salvo que APP_URL diga otra cosa
export const olvideContrasena = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.olvideContrasena(req.body.correo, urlBase(req));
    return { message: 'Si el correo está registrado, te enviamos un link para recuperar la contraseña' };
  });

export const verificarDosPasos = (req: Request, res: Response) =>
  responder(res, () => authService.verificarDosPasos(req.body.desafio, req.body.codigo));

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
