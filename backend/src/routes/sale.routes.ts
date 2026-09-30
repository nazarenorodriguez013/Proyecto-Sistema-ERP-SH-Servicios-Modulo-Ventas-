import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import { authenticate, authorizeAdministracion, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, authorizeAdministracion, saleController.getAll);
router.post('/', authenticate, authorizeAdministracion, saleController.create);
// Eliminar un comprobante revierte stock y deuda: queda restringido al administrador
router.delete('/:id', authenticate, authorizeAdmin, saleController.remove);

export default router;
