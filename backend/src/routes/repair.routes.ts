import { Router } from 'express';
import * as repairController from '../controllers/repair.controller';
import { authenticate, authorizeAdmin, authorizeAdministracion, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Administración crea, asigna técnico y factura; el técnico carga o devuelve repuestos del suyo
const taller = authorizeRoles('ADMIN', 'TECNICO');

router.get('/retiros', authenticate, authorizeAdministracion, repairController.getRetiros);
router.put('/retiros/:id', authenticate, authorizeAdministracion, repairController.marcarRetiro);

router.get('/', authenticate, repairController.getAll);
router.get('/:id', authenticate, repairController.getById);
router.post('/', authenticate, authorizeAdministracion, repairController.create);
router.post('/presupuesto', authenticate, authorizeAdministracion, repairController.presupuesto);
router.put('/:id/tecnico', authenticate, authorizeAdministracion, repairController.asignarTecnico);
router.post('/:id/repuestos', authenticate, taller, repairController.agregarRepuesto);
router.delete('/:id/repuestos/:productoId', authenticate, taller, repairController.quitarRepuesto);
router.put('/:id/finalizar', authenticate, authorizeAdministracion, repairController.finalizar);
// Eliminar un servicio revierte el stock de sus repuestos y la deuda que generó: queda restringido al administrador
router.delete('/:id', authenticate, authorizeAdmin, repairController.remove);

export default router;
