import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate, authorizeInventario } from '../middlewares/auth.middleware';

const router = Router();

// "low-stock" debe declararse antes que "/:id" para que Express no lo confunda con un ID
router.get('/', authenticate, productController.getAll);
router.get('/low-stock', authenticate, productController.getLowStock);
router.get('/:id', authenticate, productController.getById);
router.post('/', authenticate, authorizeInventario, productController.create);
router.put('/:id', authenticate, authorizeInventario, productController.update);
router.delete('/:id', authenticate, authorizeInventario, productController.remove);

export default router;
