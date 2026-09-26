import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import movementRoutes from './movement.routes';
import { authenticate, authorizeAdmin, authorizeAdministracion } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, authorizeAdministracion, clientController.getAll);
router.get('/:id', authenticate, authorizeAdministracion, clientController.getById);
router.post('/', authenticate, authorizeAdmin, clientController.create);
router.put('/:id', authenticate, authorizeAdmin, clientController.update);
router.delete('/:id', authenticate, authorizeAdmin, clientController.remove);
router.use('/:id/movements', movementRoutes);

export default router;
