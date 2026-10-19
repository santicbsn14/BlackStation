import { Router } from 'express';
import { ackPrintController, getPrintQueueController } from '../controllers/print';
import { requirePrintKey } from '../middlewares/requirePrintKey';

/** `/api/print` (§9): todo el router pasa por `requirePrintKey`. */
export const printRouter = Router();

printRouter.use(requirePrintKey);
printRouter.get('/queue', getPrintQueueController);
printRouter.post('/:id/ack', ackPrintController);
