import { validate } from '../middlewares/validate';
import { cancelPublicOrder, createOrder, getPublicOrder } from '../services/orders';
import { codigoParams, createOrderBodySchema } from '../validators/orders';

/** `POST /api/orders` */
export const createOrderController = validate(
  { body: createOrderBodySchema },
  async ({ body }, req, res) => {
    res.status(201).json(await createOrder(body, req.ip ?? ''));
  },
);

/** `GET /api/orders/:codigo` */
export const getPublicOrderController = validate(
  { params: codigoParams },
  async ({ params }, _req, res) => {
    res.json(await getPublicOrder(params.codigo));
  },
);

/** `POST /api/orders/:codigo/cancelar` */
export const cancelPublicOrderController = validate(
  { params: codigoParams },
  async ({ params }, _req, res) => {
    res.json(await cancelPublicOrder(params.codigo));
  },
);
