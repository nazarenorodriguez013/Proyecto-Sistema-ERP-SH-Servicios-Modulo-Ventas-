import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, clientController.getAll);
router.get('/:id', authenticate, clientController.getById);
router.post('/', authenticate, authorizeAdmin, clientController.create);
router.put('/:id', authenticate, authorizeAdmin, clientController.update);
router.delete('/:id', authenticate, authorizeAdmin, clientController.remove);

export default router;
