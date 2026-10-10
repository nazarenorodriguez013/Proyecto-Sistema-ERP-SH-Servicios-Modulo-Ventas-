import { Router } from 'express';
import * as companyController from '../controllers/company.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// Cualquier usuario logueado necesita los datos para imprimir comprobantes; solo el administrador los edita
router.get('/', authenticate, companyController.get);
router.put('/', authenticate, requierePermiso('configuracion.gestionar'), companyController.update);

export default router;
