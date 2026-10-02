import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Alta, edición y baja de usuarios son solo del administrador
router.use(authenticate, authorizeAdmin);
router.get('/', userController.getAll);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.post('/:id/reenviar-confirmacion', userController.reenviarConfirmacion);
router.delete('/:id', userController.remove);

export default router;
