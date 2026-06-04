import { Router } from 'express';
import { createSale, getAll } from '../controllers/sale.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// POST /api/sales — registra una nueva venta (cualquier usuario autenticado)
router.post('/', authenticate, createSale);

// GET /api/sales — lista todas las ventas con detalle (autenticado)
router.get('/', authenticate, getAll);

export default router;
