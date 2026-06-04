import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/register — crea un nuevo usuario
router.post('/register', register);

// POST /api/auth/login — devuelve JWT si las credenciales son válidas
router.post('/login', login);

export default router;
