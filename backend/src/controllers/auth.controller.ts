import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

// Registra un nuevo usuario y devuelve sus datos sin contraseña
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    const user = await authService.register(email, password, role);
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Autentica al usuario y devuelve un JWT + datos del usuario
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};
