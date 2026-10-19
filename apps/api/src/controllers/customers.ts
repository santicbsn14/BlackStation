import { validate } from '../middlewares/validate';
import { getCustomers, updateCustomer } from '../services/customers';
import {
  customersQuerySchema,
  telefonoParams,
  updateCustomerBodySchema,
} from '../validators/customers';

/** `GET /api/admin/customers` */
export const getCustomersController = validate(
  { query: customersQuerySchema },
  async ({ query }, _req, res) => {
    res.json(await getCustomers(query.q));
  },
);

/** `PATCH /api/admin/customers/:telefono` */
export const updateCustomerController = validate(
  { params: telefonoParams, body: updateCustomerBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await updateCustomer(params.telefono, body));
  },
);
