import { Router } from 'express';
import * as machineController from '../controllers/machine.controller';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// "low-stock" debe declararse antes que "/:id" para que Express no lo confunda con un ID
router.get('/', authenticate, machineController.getAll);
router.get('/low-stock', authenticate, machineController.getLowStock);
router.get('/:id', authenticate, machineController.getById);
router.post('/', authenticate, authorizeAdmin, machineController.create);
router.put('/:id', authenticate, authorizeAdmin, machineController.update);
router.delete('/:id', authenticate, authorizeAdmin, machineController.remove);

export default router;
