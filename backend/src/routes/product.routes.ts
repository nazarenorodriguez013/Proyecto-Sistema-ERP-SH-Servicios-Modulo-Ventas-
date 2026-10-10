import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// "low-stock" debe declararse antes que "/:id" para que Express no lo confunda con un ID
// Ver artículos hace falta para el catálogo, pero también para vender y para cargar repuestos en un servicio o prepararlos en el depósito
const leer = requierePermiso('productos.ver', 'productos.editar', 'ventas.crear', 'servicios.gestionar', 'servicios.repuestos', 'retiros.gestionar');
router.get('/', authenticate, leer, productController.getAll);
router.get('/low-stock', authenticate, leer, productController.getLowStock);
router.get('/:id', authenticate, leer, productController.getById);
router.post('/', authenticate, requierePermiso('productos.editar'), productController.create);
router.put('/:id', authenticate, requierePermiso('productos.editar'), productController.update);
router.delete('/:id', authenticate, requierePermiso('productos.editar'), productController.remove);

export default router;
