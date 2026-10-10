import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// "low-stock" debe declararse antes que "/:id" para que Express no lo confunda con un ID
router.get('/', authenticate, productController.getAll);
router.get('/low-stock', authenticate, productController.getLowStock);
router.get('/:id', authenticate, productController.getById);
router.post('/', authenticate, requierePermiso('productos.editar'), productController.create);
router.put('/:id', authenticate, requierePermiso('productos.editar'), productController.update);
router.delete('/:id', authenticate, requierePermiso('productos.editar'), productController.remove);

export default router;
