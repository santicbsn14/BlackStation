import {
  ACLARACION_MAX,
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  MOTIVOS_CANCELACION,
  TELEFONO_REGEX,
  type EstadoPedido,
  type MetodoPago,
  type MotivoCancelacion,
} from '@blackstation/shared';
import { z } from 'zod';
import { AppError } from '../lib/AppError';
import { cuerpo, esFecha, esObjectId, esObjeto, regla } from './common';

// §5.3. Los errores de formato salen con el `code` específico de §10 y el mensaje de `createOrder`
// de los mocks del front. El controller solo normaliza la forma del body: los chequeos corren en el
// service, en el orden de §5.3 (un local cerrado responde 423 aunque el body tenga errores).

/** Body de `POST /api/orders` con la forma mínima; los valores se validan en el service. */
export type CreateOrderInput = {
  cliente: { nombre: unknown; telefono: unknown };
  items: unknown;
  aclaracion: unknown;
  hora: unknown;
  metodoPago: unknown;
};

export const createOrderBodySchema = z.unknown().transform((body): CreateOrderInput => {
  const obj = esObjeto(body) ? body : {};
  const cliente = esObjeto(obj.cliente) ? obj.cliente : {};
  return {
    cliente: { nombre: cliente.nombre, telefono: cliente.telefono },
    items: obj.items,
    aclaracion: obj.aclaracion,
    hora: obj.hora,
    metodoPago: obj.metodoPago,
  };
});

/** `cliente.telefono` con formato normalizado, o `null` (para buscar el customer, §5.3 paso 2). */
export function telefonoValido(input: CreateOrderInput): string | null {
  const { telefono } = input.cliente;
  return typeof telefono === 'string' && TELEFONO_REGEX.test(telefono) ? telefono : null;
}

export type DatosPedido = {
  nombre: string;
  telefono: string;
  aclaracion: string | null;
  metodoPago: MetodoPago;
};

const esMetodoPago = (valor: unknown): valor is MetodoPago =>
  typeof valor === 'string' && (METODOS_PAGO as readonly string[]).includes(valor);

/** §5.3 paso 4: aclaración, nombre, teléfono y método de pago, en ese orden. */
export function validarDatosPedido(input: CreateOrderInput): DatosPedido {
  const { aclaracion: rawAclaracion, cliente, metodoPago } = input;

  if (rawAclaracion !== undefined && rawAclaracion !== null && typeof rawAclaracion !== 'string') {
    throw new AppError('INVALID_ACLARACION', 'La aclaración no es válida.');
  }
  const aclaracion = rawAclaracion?.trim() || null;
  if (aclaracion && aclaracion.length > ACLARACION_MAX) {
    throw new AppError(
      'INVALID_ACLARACION',
      `La aclaración no puede superar los ${ACLARACION_MAX} caracteres.`,
    );
  }

  const nombre = typeof cliente.nombre === 'string' ? cliente.nombre.trim() : '';
  if (!nombre) throw new AppError('INVALID_NOMBRE', 'Falta el nombre.');

  const telefono = telefonoValido(input);
  if (!telefono) throw new AppError('INVALID_TELEFONO', 'El teléfono no es válido.');

  if (!esMetodoPago(metodoPago)) {
    throw new AppError('INVALID_METODO_PAGO', 'El método de pago no es válido.');
  }

  return { nombre, telefono, aclaracion, metodoPago };
}

/** §3.4: 8 caracteres sin los ambiguos (`0`, `O`, `1`, `I`, `L`). */
export const CODIGO_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODIGO_LARGO = 8;
const CODIGO_REGEX = new RegExp(`^[${CODIGO_ALFABETO}]{${CODIGO_LARGO}}$`);

/** `:codigo` de la ruta. Con otro formato no puede existir: 404 sin ir a la base. */
export const codigoParams = z.object({
  codigo: z.string().transform((codigo) => {
    if (!CODIGO_REGEX.test(codigo)) {
      throw new AppError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
    }
    return codigo;
  }),
});

// Panel (§8.1). Mismas reglas y mensajes que `getAdminOrders`/`updateOrderEstado` de los mocks.

const incluye =
  <T extends string>(lista: readonly T[]) =>
  (valor: unknown): valor is T =>
    typeof valor === 'string' && (lista as readonly string[]).includes(valor);

const estadoPedido = regla(incluye(ESTADOS_PEDIDO), 'El estado no es válido.');

/** `:id` del panel y del print server. Mal formado no puede existir: 404 sin ir a la base. */
export const orderIdParams = z.object({
  id: z.string().transform((id) => {
    if (!esObjectId(id)) throw new AppError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
    return id;
  }),
});

const esFechaIso = (valor: unknown): valor is string =>
  typeof valor === 'string' && !Number.isNaN(Date.parse(valor));

export const adminOrdersQuerySchema = z.object({
  fecha: regla(esFecha, 'La fecha no es válida.').optional(),
  estado: estadoPedido.optional(),
  since: regla(esFechaIso, '`since` no es una fecha válida.')
    .transform((s) => new Date(s))
    .optional(),
});

export type AdminOrdersInput = z.output<typeof adminOrdersQuerySchema>;

/**
 * Body de `PATCH .../estado`. Al cancelar, el motivo tiene que ser uno de §3.4; que el panel pueda
 * usarlo (`manual`/`no_retiro`) lo decide `puedeTransicionar` (409). Con otro estado se ignora.
 */
export const updateOrderEstadoBodySchema = cuerpo(
  z.object({ estado: estadoPedido, motivoCancelacion: z.unknown().optional() }),
).transform(({ estado, motivoCancelacion }, ctx): UpdateOrderEstadoInput => {
  if (estado !== 'cancelado') return { estado, motivoCancelacion: null };
  if (!incluye(MOTIVOS_CANCELACION)(motivoCancelacion)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Para cancelar hace falta el motivo: `manual` o `no_retiro`.',
    });
    return z.NEVER;
  }
  return { estado, motivoCancelacion };
});

export type UpdateOrderEstadoInput = {
  estado: EstadoPedido;
  motivoCancelacion: MotivoCancelacion | null;
};
