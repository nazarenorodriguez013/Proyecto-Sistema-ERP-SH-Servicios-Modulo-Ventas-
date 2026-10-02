import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Cada usuario ve solo lo que le corresponde (se filtra en el service según su rol y módulos)
router.get('/', authenticate, notificationController.listar);
router.put('/leidas', authenticate, notificationController.marcarLeidas);

export default router;
