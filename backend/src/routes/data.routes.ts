import { Router, json } from 'express';
import * as dataController from '../controllers/data.controller';
import { authenticate, requierePermiso } from '../middlewares/auth.middleware';

const router = Router();

// El CSV viaja dentro del JSON: se permite hasta 8 MB (el catálogo acepta archivos de hasta 6 MB).
// Por eso este router se monta antes del express.json() general, que tiene el límite chico por defecto.
const archivo = json({ limit: '8mb' });

router.post('/import/preview', archivo, authenticate, requierePermiso('datos.importar'), dataController.previsualizar);
router.post('/import/run', archivo, authenticate, requierePermiso('datos.importar'), dataController.importar);
router.get('/export/:dataset', authenticate, requierePermiso('datos.exportar'), dataController.exportar);

export default router;
