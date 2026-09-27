import { Router } from 'express';
import * as technicianController from '../controllers/technician.controller';
import { authenticate, authorizeAdmin, authorizeAdministracion } from '../middlewares/auth.middleware';

const router = Router();

// Administración necesita la lista para asignar servicios; solo el administrador da de alta, edita o borra técnicos
router.get('/', authenticate, authorizeAdministracion, technicianController.getAll);
router.post('/', authenticate, authorizeAdmin, technicianController.create);
router.put('/:id', authenticate, authorizeAdmin, technicianController.update);
router.delete('/:id', authenticate, authorizeAdmin, technicianController.remove);

export default router;
