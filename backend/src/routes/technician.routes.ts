import { Router } from 'express';
import * as technicianController from '../controllers/technician.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// Administración necesita la lista para asignar servicios; solo el administrador da de alta, edita o borra técnicos
router.get('/', authenticate, requierePermiso('tecnicos.ver', 'servicios.gestionar'), technicianController.getAll);
router.post('/', authenticate, requierePermiso('tecnicos.gestionar'), technicianController.create);
router.put('/:id', authenticate, requierePermiso('tecnicos.gestionar'), technicianController.update);
router.delete('/:id', authenticate, requierePermiso('tecnicos.gestionar'), technicianController.remove);

export default router;
