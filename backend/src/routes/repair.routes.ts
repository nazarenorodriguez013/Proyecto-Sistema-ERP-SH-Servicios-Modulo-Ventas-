import { Router } from 'express';
import * as repairController from '../controllers/repair.controller';
import { authenticate, authorizeAdmin, authorizeAdministracion, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Administración crea, asigna técnico y factura; el técnico carga o devuelve repuestos del suyo
const taller = authorizeRoles('ADMIN', 'TECNICO');

// La cola de retiros la maneja el depósito (rol Inventario) y la ve también administración
const deposito = authorizeRoles('ADMIN', 'VENDEDOR', 'INVENTARIO');
router.get('/retiros', authenticate, deposito, repairController.getRetiros);
router.put('/retiros/:id', authenticate, deposito, repairController.marcarRetiro);

// El rol Inventario no ve los servicios, solo su cola de retiros
const conServicios = authorizeRoles('ADMIN', 'VENDEDOR', 'TECNICO');
router.get('/', authenticate, conServicios, repairController.getAll);
router.get('/:id', authenticate, conServicios, repairController.getById);
router.post('/', authenticate, authorizeAdministracion, repairController.create);
router.post('/presupuesto', authenticate, authorizeAdministracion, repairController.presupuesto);
// El técnico ajusta mano de obra, fecha estimada y notas de su servicio (el service verifica que sea suyo)
router.put('/:id', authenticate, conServicios, repairController.actualizar);
router.put('/:id/tecnico', authenticate, authorizeAdministracion, repairController.asignarTecnico);
router.post('/:id/repuestos', authenticate, taller, repairController.agregarRepuesto);
router.delete('/:id/repuestos/:productoId', authenticate, taller, repairController.quitarRepuesto);
// Finaliza administración o el técnico dueño del servicio (el service verifica que sea suyo)
router.put('/:id/finalizar', authenticate, conServicios, repairController.finalizar);
// Eliminar un servicio revierte el stock de sus repuestos y la deuda que generó: queda restringido al administrador
router.delete('/:id', authenticate, authorizeAdmin, repairController.remove);

export default router;
