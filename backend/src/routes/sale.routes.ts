import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import { authenticate, authorizeAdministracion } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, authorizeAdministracion, saleController.getAll);
router.post('/', authenticate, authorizeAdministracion, saleController.create);

export default router;
