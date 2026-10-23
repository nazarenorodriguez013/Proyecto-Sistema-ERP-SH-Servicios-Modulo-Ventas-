import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import * as movementController from '../controllers/movement.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, requierePermiso('auditoria.ver'), auditController.listar);
// Pagos de cuenta corriente que se eliminaron: quién los cargó, quién los eliminó, cuándo y por qué
router.get('/pagos-eliminados', authenticate, requierePermiso('auditoria.ver'), movementController.eliminados);

export default router;
