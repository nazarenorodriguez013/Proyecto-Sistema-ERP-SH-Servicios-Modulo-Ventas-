import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

// Crea un usuario nuevo; nunca devuelve la contraseña en la respuesta
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, correo, contrasena } = req.body;
    const usuario = await authService.register(nombre, correo, contrasena);
    res.status(201).json({ id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// Verifica credenciales y devuelve el token JWT junto con los datos del usuario
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { correo, contrasena } = req.body;
    const result = await authService.login(correo, contrasena);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ message: err.message });
  }
};
