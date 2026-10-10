import { Router } from 'express';
import * as roleController from '../controllers/role.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
// La pantalla de Usuarios también necesita la lista de roles (para elegir el rol y ver el resumen)
router.get('/', requierePermiso('roles.gestionar', 'usuarios.ver', 'usuarios.gestionar'), roleController.getAll);
router.get('/permisos', requierePermiso('roles.gestionar'), roleController.catalogo);
router.get('/:id', requierePermiso('roles.gestionar'), roleController.getById);
router.post('/', requierePermiso('roles.gestionar'), roleController.create);
router.put('/:id', requierePermiso('roles.gestionar'), roleController.update);
router.delete('/:id', requierePermiso('roles.gestionar'), roleController.remove);

export default router;
