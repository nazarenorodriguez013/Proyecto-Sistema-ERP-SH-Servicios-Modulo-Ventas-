import { Router } from 'express';
import { getAll, create } from '../controllers/category.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// GET /api/categories — cualquier usuario autenticado puede listar categorías
router.get('/', authenticate, getAll);

// POST /api/categories — solo admins pueden crear categorías
router.post('/', authenticate, requireAdmin, create);

export default router;
