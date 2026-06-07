import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Listar está disponible para cualquier usuario autenticado; crear/editar/borrar solo para admins
router.get('/', authenticate, categoryController.getAll);
router.post('/', authenticate, authorizeAdmin, categoryController.create);
router.put('/:id', authenticate, authorizeAdmin, categoryController.update);
router.delete('/:id', authenticate, authorizeAdmin, categoryController.remove);

export default router;
