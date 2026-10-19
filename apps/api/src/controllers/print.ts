import type { RequestHandler } from 'express';
import { validate } from '../middlewares/validate';
import { ackPrint, getPrintQueue } from '../services/print';
import { orderIdParams } from '../validators/orders';

/** `GET /api/print/queue` */
export const getPrintQueueController: RequestHandler = async (_req, res) => {
  res.json(await getPrintQueue());
};

/** `POST /api/print/:id/ack` */
export const ackPrintController = validate(
  { params: orderIdParams },
  async ({ params }, _req, res) => {
    res.json(await ackPrint(params.id));
  },
);
