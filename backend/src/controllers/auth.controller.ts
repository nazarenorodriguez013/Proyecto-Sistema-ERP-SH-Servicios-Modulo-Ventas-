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
  responder(res, () => authService.actualizarCuenta(req.user!.id, urlBase(req), req.body));

// El link del mail apunta al mismo sitio desde el que se pidió, salvo que APP_URL diga otra cosa
export const olvideContrasena = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.olvideContrasena(req.body.correo, urlBase(req));
    return { message: 'Si el correo está registrado, te enviamos un link para recuperar la contraseña' };
  });

export const confirmarCorreo = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.confirmarCorreo(req.body.token);
    return { message: 'Correo confirmado. Ya podés iniciar sesión' };
  });

export const restablecerContrasena = (req: Request, res: Response) =>
  responder(res, async () => {
    await authService.restablecerContrasena(req.body.token, req.body.contrasena);
    return { message: 'Contraseña actualizada. Ya podés iniciar sesión' };
  });
