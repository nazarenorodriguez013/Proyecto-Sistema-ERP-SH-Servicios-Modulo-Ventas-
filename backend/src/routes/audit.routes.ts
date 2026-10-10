import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, requierePermiso('auditoria.ver'), auditController.listar);

export default router;
