import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Hashea la contraseña antes de guardarla; nunca se almacena en texto plano
export const register = async (nombre: string, correo: string, contrasena: string) => {
  const hashed = await bcrypt.hash(contrasena, 10);
  return prisma.usuario.create({ data: { nombre, correo, contrasena: hashed } });
};

// Mismo mensaje de error tanto si el correo no existe como si la contraseña es incorrecta,
// para no revelar a un atacante cuál de los dos datos está mal
export const login = async (correo: string, contrasena: string) => {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) throw new Error('Credenciales inválidas');
  const valid = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!valid) throw new Error('Credenciales inválidas');
  const token = jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
    process.env.JWT_SECRET as string,
    { expiresIn: '8h' }
  );
  return { token, user: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol } };
};
