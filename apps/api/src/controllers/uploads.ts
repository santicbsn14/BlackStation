import { validate } from '../middlewares/validate';
import { getUploadSignature } from '../services/uploads';
import { uploadSignatureBodySchema } from '../validators/catalog';

/** `POST /api/admin/uploads/signature` */
export const uploadSignatureController = validate(
  { body: uploadSignatureBodySchema },
  ({ body }, _req, res) => {
    res.json(getUploadSignature(body.folder));
  },
);
