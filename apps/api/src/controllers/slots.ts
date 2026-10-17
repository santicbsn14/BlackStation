import type { RequestHandler } from 'express';
import { validate } from '../middlewares/validate';
import { getAdminSlots, getPublicSlots, updateSlot } from '../services/slots';
import { adminSlotsQuerySchema, updateSlotBodySchema } from '../validators/slots';

/** `GET /api/slots` */
export const getPublicSlotsController: RequestHandler = async (_req, res) => {
  res.json(await getPublicSlots());
};

/** `GET /api/admin/slots` */
export const getAdminSlotsController = validate(
  { query: adminSlotsQuerySchema },
  async ({ query }, _req, res) => {
    res.json(await getAdminSlots(query.fecha));
  },
);

/** `PATCH /api/admin/slots` */
export const updateSlotController = validate(
  { body: updateSlotBodySchema },
  async ({ body }, _req, res) => {
    res.json(await updateSlot(body));
  },
);
