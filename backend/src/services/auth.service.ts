import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Hashea la contraseña con bcrypt (10 rondas) y guarda el usuario en la BD
export const register = async (email: string, password: string, role: string = 'User') => {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, password: hashed, role } });
};

// Verifica credenciales y genera un JWT con duración de 12 horas
export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Usuario no encontrado');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Contraseña incorrecta');

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
};
