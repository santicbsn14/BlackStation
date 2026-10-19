import { validate } from '../middlewares/validate';
import {
  cancelPublicOrder,
  createOrder,
  extendOrder,
  getAdminOrders,
  getPublicOrder,
  reprintOrder,
  updateOrderEstado,
} from '../services/orders';
import {
  adminOrdersQuerySchema,
  codigoParams,
  createOrderBodySchema,
  orderIdParams,
  updateOrderEstadoBodySchema,
} from '../validators/orders';

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

/** `GET /api/admin/orders` */
export const getAdminOrdersController = validate(
  { query: adminOrdersQuerySchema },
  async ({ query }, _req, res) => {
    res.json(await getAdminOrders(query));
  },
);

/** `PATCH /api/admin/orders/:id/estado` */
export const updateOrderEstadoController = validate(
  { params: orderIdParams, body: updateOrderEstadoBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await updateOrderEstado(params.id, body));
  },
);

/** `PATCH /api/admin/orders/:id/extender` */
export const extendOrderController = validate(
  { params: orderIdParams },
  async ({ params }, _req, res) => {
    res.json(await extendOrder(params.id));
  },
);

/** `POST /api/admin/orders/:id/reprint` */
export const reprintOrderController = validate(
  { params: orderIdParams },
  async ({ params }, _req, res) => {
    res.json(await reprintOrder(params.id));
  },
);
