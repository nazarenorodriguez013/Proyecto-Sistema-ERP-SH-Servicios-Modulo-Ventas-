import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Sin authenticate: son el punto de entrada antes de tener un token. Los usuarios los crea el administrador
// desde Configuración (/api/users), ya no hay registro público.
router.post('/login', auth.login);
router.get('/config', auth.config);
router.post('/google', auth.loginGoogle);
router.post('/forgot', auth.olvideContrasena);
router.post('/reset', auth.restablecerContrasena);
router.put('/me', authenticate, auth.actualizarCuenta);

export default router;
