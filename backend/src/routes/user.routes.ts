import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', requierePermiso('usuarios.ver', 'usuarios.gestionar'), userController.getAll);
router.post('/', requierePermiso('usuarios.gestionar'), userController.create);
router.put('/:id', requierePermiso('usuarios.gestionar'), userController.update);
router.delete('/:id', requierePermiso('usuarios.gestionar'), userController.remove);

export default router;
