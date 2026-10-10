import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, requierePermiso('ventas.ver'), saleController.getAll);
router.post('/', authenticate, requierePermiso('ventas.crear'), saleController.create);
// Eliminar un comprobante revierte stock y deuda: queda restringido al administrador
router.delete('/:id', authenticate, requierePermiso('ventas.anular'), saleController.remove);

export default router;
