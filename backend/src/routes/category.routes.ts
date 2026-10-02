import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorizeInventario } from '../middlewares/auth.middleware';

const router = Router();

// Listar está disponible para cualquier usuario autenticado; crear/editar/borrar para el administrador y el rol Inventario
router.get('/', authenticate, categoryController.getAll);
router.post('/', authenticate, authorizeInventario, categoryController.create);
router.put('/:id', authenticate, authorizeInventario, categoryController.update);
router.delete('/:id', authenticate, authorizeInventario, categoryController.remove);

export default router;
