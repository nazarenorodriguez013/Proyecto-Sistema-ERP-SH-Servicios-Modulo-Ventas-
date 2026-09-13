import { Router } from 'express';
import * as movementController from '../controllers/movement.controller';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';

// mergeParams para acceder a :id (cliente) cuando se monta bajo /clients/:id/movements
const router = Router({ mergeParams: true });

router.post('/', authenticate, authorizeAdmin, movementController.create);
router.delete('/:movementId', authenticate, authorizeAdmin, movementController.remove);

export default router;
