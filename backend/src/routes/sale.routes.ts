import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, saleController.getAll);
router.post('/', authenticate, saleController.create);

export default router;
