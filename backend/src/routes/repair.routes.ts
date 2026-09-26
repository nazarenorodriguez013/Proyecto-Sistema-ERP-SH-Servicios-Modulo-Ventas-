import { Router } from 'express';
import * as repairController from '../controllers/repair.controller';
import { authenticate, authorizeAdministracion, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Administración registra, presupuesta, asigna y cobra; el técnico carga repuestos y termina la reparación
const taller = authorizeRoles('ADMIN', 'TECNICO');

// "technicians" debe declararse antes que "/:id" para que Express no lo confunda con un ID
router.get('/', authenticate, repairController.getAll);
router.get('/technicians', authenticate, authorizeAdministracion, repairController.getTecnicos);
router.get('/:id', authenticate, repairController.getById);
router.post('/', authenticate, authorizeAdministracion, repairController.create);
router.put('/:id/presupuesto', authenticate, authorizeAdministracion, repairController.responderPresupuesto);
router.put('/:id/tecnico', authenticate, authorizeAdministracion, repairController.asignarTecnico);
router.post('/:id/repuestos', authenticate, taller, repairController.agregarRepuesto);
router.delete('/:id/repuestos/:productoId', authenticate, taller, repairController.quitarRepuesto);
router.put('/:id/reparado', authenticate, taller, repairController.marcarReparado);
router.put('/:id/entregar', authenticate, authorizeAdministracion, repairController.entregar);

export default router;
