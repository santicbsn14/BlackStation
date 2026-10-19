import type { AdminCustomersResponse, Customer } from '@blackstation/shared';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { escaparRegex, normalizarBusqueda } from '../lib/texto';
import { toCustomer, type CustomerLean } from '../mappers/customers';
import { CustomerModel } from '../models';
import type { UpdateCustomerInput } from '../validators/customers';

// §3.6 y §8.5. Mismas reglas y mensajes que `getCustomers`, `updateCustomer` y `sumarAlCustomer`
// de los mocks del front.

const MAX_CLIENTES = 50;

/**
 * §3.6: `entregados++` al entregar, `noShows++` al cancelar con `no_retiro`. Si el customer no
 * existe, no hace nada (no se crea).
 */
export async function sumarAlCustomer(
  telefono: string,
  contador: 'entregados' | 'noShows',
): Promise<void> {
  await CustomerModel.updateOne(
    { telefono },
    { $inc: { [contador]: 1 }, $set: { updatedAt: now() } },
    { timestamps: false },
  );
}

/**
 * `GET /api/admin/customers` (§8.5). `q` solo dígitos busca en el teléfono; si no, en
 * `nombreBusqueda` (sin mayúsculas ni tildes, como texto literal).
 */
export async function getCustomers(q = ''): Promise<AdminCustomersResponse> {
  const filtro = !q
    ? {}
    : /^\d+$/.test(q)
      ? { telefono: { $regex: q } }
      : { nombreBusqueda: { $regex: escaparRegex(normalizarBusqueda(q)) } };
  // Descendente: los `null` quedan al final.
  const docs = await CustomerModel.find(filtro)
    .sort({ ultimoPedidoAt: -1, _id: 1 })
    .limit(MAX_CLIENTES)
    .lean<CustomerLean[]>();
  return { customers: docs.map(toCustomer) };
}

/**
 * `PATCH /api/admin/customers/:telefono` (§8.5). Cambiar `estado` lo marca manual, salvo
 * `estadoManual: false` explícito.
 */
export async function updateCustomer(
  telefono: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const { estado, estadoManual } = input;
  const cambios =
    estado !== undefined ? { estado, estadoManual: estadoManual ?? true } : { estadoManual };

  const doc = await CustomerModel.findOneAndUpdate(
    { telefono },
    { $set: { ...cambios, updatedAt: now() } },
    { returnDocument: 'after', timestamps: false },
  ).lean<CustomerLean>();
  if (!doc) throw new AppError('CUSTOMER_NOT_FOUND', 'No encontramos ese cliente.');
  return toCustomer(doc);
}
