import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import movementRoutes from './movement.routes';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, requierePermiso('clientes.gestionar'), clientController.getAll);
router.get('/:id', authenticate, requierePermiso('clientes.gestionar'), clientController.getById);
// Administración atiende al cliente de punta a punta; borrar queda solo para el administrador
router.post('/', authenticate, requierePermiso('clientes.gestionar'), clientController.create);
router.put('/:id', authenticate, requierePermiso('clientes.gestionar'), clientController.update);
router.delete('/:id', authenticate, requierePermiso('clientes.eliminar'), clientController.remove);
router.use('/:id/movements', movementRoutes);

export default router;
