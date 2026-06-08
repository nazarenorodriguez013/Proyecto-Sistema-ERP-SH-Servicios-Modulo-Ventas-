import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

// Sin authenticate: estas rutas son el punto de entrada antes de tener un token
router.post('/register', register);
router.post('/login', login);

export default router;