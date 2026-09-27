import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import movementRoutes from './movement.routes';
import { authenticate, authorizeAdmin, authorizeAdministracion } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, authorizeAdministracion, clientController.getAll);
router.get('/:id', authenticate, authorizeAdministracion, clientController.getById);
// Administración atiende al cliente de punta a punta; borrar queda solo para el administrador
router.post('/', authenticate, authorizeAdministracion, clientController.create);
router.put('/:id', authenticate, authorizeAdministracion, clientController.update);
router.delete('/:id', authenticate, authorizeAdmin, clientController.remove);
router.use('/:id/movements', movementRoutes);

export default router;
