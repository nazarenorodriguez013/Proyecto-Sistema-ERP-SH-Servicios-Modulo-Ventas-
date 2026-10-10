import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// Listar está disponible para cualquier usuario autenticado; crear/editar/borrar para el administrador y el rol Inventario
router.get('/', authenticate, categoryController.getAll);
router.post('/', authenticate, requierePermiso('categorias.gestionar'), categoryController.create);
router.put('/:id', authenticate, requierePermiso('categorias.gestionar'), categoryController.update);
router.delete('/:id', authenticate, requierePermiso('categorias.gestionar'), categoryController.remove);

export default router;
