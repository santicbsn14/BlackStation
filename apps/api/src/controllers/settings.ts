import type { RequestHandler } from 'express';
import { validate } from '../middlewares/validate';
import { getPublicSettings, getSettings, updateSettings } from '../services/settings';
import { updateSettingsBodySchema } from '../validators/settings';

/** `GET /api/public-settings` */
export const getPublicSettingsController: RequestHandler = async (_req, res) => {
  res.json(await getPublicSettings());
};

/** `GET /api/admin/settings` */
export const getAdminSettingsController: RequestHandler = async (_req, res) => {
  res.json(await getSettings());
};

/** `PUT /api/admin/settings` */
export const putAdminSettingsController = validate(
  { body: updateSettingsBodySchema },
  async ({ body }, _req, res) => {
    res.json(await updateSettings(body));
  },
);
