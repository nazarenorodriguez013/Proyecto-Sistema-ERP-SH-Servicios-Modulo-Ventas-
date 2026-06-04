import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../controllers/product.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// GET /api/products — lista todos los productos (autenticado)
router.get('/', authenticate, getAll);

// GET /api/products/:id — obtiene un producto por ID (autenticado)
router.get('/:id', authenticate, getById);

// POST /api/products — crea un producto (solo admin)
router.post('/', authenticate, requireAdmin, create);

// PUT /api/products/:id — actualiza un producto (solo admin)
router.put('/:id', authenticate, requireAdmin, update);

// DELETE /api/products/:id — elimina un producto (solo admin)
router.delete('/:id', authenticate, requireAdmin, remove);

export default router;
