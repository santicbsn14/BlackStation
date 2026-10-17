import {
  ACLARACION_MAX,
  METODOS_PAGO,
  TELEFONO_REGEX,
  type MetodoPago,
} from '@blackstation/shared';
import { z } from 'zod';
import { AppError } from '../lib/AppError';
import { esObjeto } from './common';

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
