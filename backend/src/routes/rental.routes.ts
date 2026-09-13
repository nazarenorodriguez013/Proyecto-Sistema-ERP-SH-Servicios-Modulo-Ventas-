import { Router } from 'express';
import * as rentalController from '../controllers/rental.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, rentalController.getAll);
router.post('/', authenticate, rentalController.create);
router.put('/:id/estado', authenticate, rentalController.updateEstado);

export default router;
