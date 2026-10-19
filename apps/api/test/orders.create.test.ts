import type * as crypto from 'node:crypto';
import { randomInt } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from '../src/app';
import { setClock } from '../src/lib/clock';
import { ORDER_MAX_POR_IP } from '../src/lib/orderLimiter';
import {
  CategoryModel,
  CounterModel,
  CustomerModel,
  ExtraModel,
  OrderModel,
  PickupSlotModel,
  SettingsModel,
} from '../src/models';
import { useTestDb } from './db';
import {
  ABIERTO,
  BACON,
  BEBIDAS,
  CEBOLLA_CARAMELIZADA,
  CHEDDAR,
  COCA,
  FECHA,
  HAMBURGUESA_AGOTADA,
  LOMITO_COMPLETO,
  LOMITO_INACTIVO,
  MIN,
  TEL_BLOQUEADO,
  TEL_TRANSFERENCIA,
  avanzarReloj,
  fijarReloj,
  nuevaIp,
  nuevoTelefono,
  pedido,
  postOrder,
  prepararBase,
} from './pedidos';

// `randomInt` espiable para forzar choques de `codigo`; por defecto usa el original.
vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof crypto>();
  return { ...original, randomInt: vi.fn(original.randomInt) };
});
const randomIntMock = randomInt as unknown as Mock<(max: number) => number>;

useTestDb();

const app = createApp();

beforeEach(prepararBase);

afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
  randomIntMock.mockReset();
});

const CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

const ocupados = async (hora = '22:00') =>
  (await PickupSlotModel.findOne({ fecha: FECHA, hora }).lean())?.ocupados ?? 0;

function esperarError(
  res: { status: number; body: unknown },
  status: number,
  code: string,
  message?: string,
) {
  expect(res.status).toBe(status);
  const { error } = res.body as { error: { code: string; message: string } };
  expect(error.code).toBe(code);
  if (message !== undefined) expect(error.message).toBe(message);
}

const item = (cambios: object = {}) => ({
  productoId: LOMITO_COMPLETO,
  cantidad: 1,
  quitados: [],
  extras: [],
  ...cambios,
});

describe('pedido válido', () => {
  it('201 con numero correlativo, codigo del alfabeto y cupo reservado', async () => {
    const res = await postOrder(app, pedido());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      codigo: expect.stringMatching(CODIGO),
      numero: 1,
      estado: 'pendiente',
      horaRetiro: '22:00',
      total: 14500,
      expiresAt: null,
    });
    expect(await ocupados()).toBe(1);

    const segundo = await postOrder(app, pedido({ hora: '22:15' }));
    expect(segundo.status).toBe(201);
    expect(segundo.body.numero).toBe(2);
    expect(segundo.body.codigo).not.toBe(res.body.codigo);
  });

  it('guarda el pedido completo con fechas del reloj de la API', async () => {
    const telefono = nuevoTelefono();
    const res = await postOrder(
      app,
      pedido({ cliente: { nombre: '  Ana  ', telefono }, aclaracion: '  sin sal  ' }),
    );
    const order = await OrderModel.findOne({ codigo: res.body.codigo }).lean();
    const slot = await PickupSlotModel.findOne({ fecha: FECHA, hora: '22:00' }).lean();
    expect(order).toMatchObject({
      numero: 1,
      fecha: FECHA,
      cliente: { nombre: 'Ana', telefono },
      aclaracion: 'sin sal',
      horaRetiro: '22:00',
      metodoPago: 'retiro',
      estado: 'pendiente',
      expiresAt: null,
      confirmadoAt: null,
      entregadoAt: null,
      canceladoAt: null,
      motivoCancelacion: null,
      impresoAt: null,
      createdAt: new Date(ABIERTO),
      updatedAt: new Date(ABIERTO),
    });
    expect(order?.slotId.toString()).toBe(slot?._id.toString());
    expect(slot).toMatchObject({ inicio: new Date('2026-10-17T01:00:00.000Z'), cupoMax: 6 });
  });

  it('aclaración vacía o de 140 caracteres', async () => {
    const vacia = await postOrder(app, pedido({ aclaracion: '   ' }));
    expect(vacia.status).toBe(201);
    expect((await OrderModel.findOne({ codigo: vacia.body.codigo }).lean())?.aclaracion).toBeNull();

    expect((await postOrder(app, pedido({ aclaracion: 'a'.repeat(140) }))).status).toBe(201);
  });

  it('crea el customer con pedidosTotal: 1 y nombreBusqueda', async () => {
    const telefono = nuevoTelefono();
    await postOrder(app, pedido({ cliente: { nombre: 'José Pérez', telefono } }));
    const customer = await CustomerModel.findOne({ telefono }).lean();
    expect(customer).toMatchObject({
      telefono,
      nombre: 'José Pérez',
      nombreBusqueda: 'jose perez',
      pedidosTotal: 1,
      entregados: 0,
      noShows: 0,
      estado: 'normal',
      estadoManual: false,
      ultimoPedidoAt: new Date(ABIERTO),
      createdAt: new Date(ABIERTO),
    });
  });

  it('customer existente: pedidosTotal++, último nombre y ultimoPedidoAt', async () => {
    const telefono = nuevoTelefono();
    await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono } }));
    avanzarReloj(MIN);
    await postOrder(app, pedido({ cliente: { nombre: 'Ána María', telefono } }));

    const customer = await CustomerModel.findOne({ telefono }).lean();
    expect(customer).toMatchObject({
      nombre: 'Ána María',
      nombreBusqueda: 'ana maria',
      pedidosTotal: 2,
      ultimoPedidoAt: new Date(ABIERTO + MIN),
      createdAt: new Date(ABIERTO),
    });
    expect(await CustomerModel.countDocuments({ telefono })).toBe(1);
  });

  it('transferencia → expiresAt = creación + minutosTransferencia', async () => {
    const res = await postOrder(app, pedido({ metodoPago: 'transferencia' }));
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBe(new Date(ABIERTO + 15 * MIN).toISOString());

    await SettingsModel.updateOne({}, { $set: { minutosTransferencia: 30 } });
    const otro = await postOrder(app, pedido({ metodoPago: 'transferencia' }));
    expect(otro.body.expiresAt).toBe(new Date(ABIERTO + 30 * MIN).toISOString());
  });

  it('retiro → expiresAt: null', async () => {
    const res = await postOrder(app, pedido({ metodoPago: 'retiro' }));
    expect(res.body.expiresAt).toBeNull();
  });
});

describe('snapshot', () => {
  it('precios de la base aunque el body mande otros; subtotal y total con extras y cantidades', async () => {
    const res = await postOrder(
      app,
      pedido({
        items: [
          item({
            cantidad: 2,
            precioUnitario: 1,
            subtotal: 1,
            quitados: ['lechuga', 'tomate'],
            extras: [
              { extraId: CHEDDAR, cantidad: 2, precio: 1 },
              { extraId: BACON, cantidad: 1 },
            ],
          }),
          { productoId: COCA, cantidad: 3, quitados: [], extras: [], precio: 0 },
        ],
        total: 10,
      }),
    );
    expect(res.status).toBe(201);
    // Lomito: (14500 + 1200 × 2 + 1500) × 2 = 36800. Coca: 2500 × 3 = 7500.
    expect(res.body.total).toBe(44300);

    const order = await OrderModel.findOne({ codigo: res.body.codigo }).lean();
    expect(order?.total).toBe(44300);
    expect(
      order?.items.map((i) => ({
        ...i,
        productoId: i.productoId.toString(),
        extras: i.extras.map((e) => ({ ...e, extraId: e.extraId.toString() })),
      })),
    ).toEqual([
      {
        productoId: LOMITO_COMPLETO,
        nombre: 'Lomito completo',
        precioUnitario: 14500,
        cantidad: 2,
        quitados: ['lechuga', 'tomate'],
        extras: [
          { extraId: CHEDDAR, nombre: 'Cheddar extra', precio: 1200, cantidad: 2 },
          { extraId: BACON, nombre: 'Bacon', precio: 1500, cantidad: 1 },
        ],
        subtotal: 36800,
      },
      {
        productoId: COCA,
        nombre: 'Coca-Cola 500 ml',
        precioUnitario: 2500,
        cantidad: 3,
        quitados: [],
        extras: [],
        subtotal: 7500,
      },
    ]);
  });

  it('quitados y extras se pueden omitir (cuentan como vacíos)', async () => {
    const res = await postOrder(app, pedido({ items: [{ productoId: COCA, cantidad: 1 }] }));
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(2500);
  });
});

describe('validaciones de §5.3', () => {
  it('pedidos deshabilitados → 423 ORDERS_DISABLED', async () => {
    await SettingsModel.updateOne({}, { $set: { pedidosHabilitados: false } });
    esperarError(
      await postOrder(app, pedido()),
      423,
      'ORDERS_DISABLED',
      'En este momento no estamos tomando pedidos.',
    );
  });

  it('fuera de horario → 423 CLOSED', async () => {
    fijarReloj(Date.parse('2026-10-16T18:00:00.000Z')); // viernes 15:00
    esperarError(
      await postOrder(app, pedido()),
      423,
      'CLOSED',
      'El local está cerrado en este momento. Volvé en el horario de atención.',
    );
  });

  it('día inactivo → 423 CLOSED', async () => {
    fijarReloj(Date.parse('2026-10-20T00:00:00.000Z')); // lunes 21:00
    esperarError(await postOrder(app, pedido()), 423, 'CLOSED', 'Hoy el local está cerrado.');
  });

  it('local cerrado responde 423 aunque el body tenga errores (orden de §5.3)', async () => {
    fijarReloj(Date.parse('2026-10-16T18:00:00.000Z'));
    esperarError(await postOrder(app, { items: [] }), 423, 'CLOSED');
  });

  it('customer bloqueado → 403 CUSTOMER_BLOCKED', async () => {
    esperarError(
      await postOrder(app, pedido({ cliente: { nombre: 'X', telefono: TEL_BLOQUEADO } })),
      403,
      'CUSTOMER_BLOCKED',
      'No podemos tomar tu pedido online.',
    );
  });

  it('requiereTransferencia pidiendo retiro → 403 TRANSFER_REQUIRED; con transferencia pasa', async () => {
    const cliente = { nombre: 'X', telefono: TEL_TRANSFERENCIA };
    esperarError(
      await postOrder(app, pedido({ cliente, metodoPago: 'retiro' })),
      403,
      'TRANSFER_REQUIRED',
      'Para este número el pago es por transferencia.',
    );
    expect((await postOrder(app, pedido({ cliente, metodoPago: 'transferencia' }))).status).toBe(
      201,
    );
  });

  describe('producto no disponible → 400 PRODUCT_UNAVAILABLE', () => {
    const mensaje = 'Uno de los productos ya no está disponible.';

    it.each([
      ['inactivo', LOMITO_INACTIVO],
      ['agotado', HAMBURGUESA_AGOTADA],
      ['inexistente', '66f1c0000000000000000099'],
      ['id mal formado', 'no-es-un-id'],
    ])('%s', async (_caso, productoId) => {
      esperarError(
        await postOrder(app, pedido({ items: [item({ productoId })] })),
        400,
        'PRODUCT_UNAVAILABLE',
        mensaje,
      );
    });

    it('de categoría inactiva', async () => {
      await CategoryModel.updateOne({ _id: BEBIDAS }, { $set: { activa: false } });
      esperarError(
        await postOrder(app, pedido({ items: [item({ productoId: COCA })] })),
        400,
        'PRODUCT_UNAVAILABLE',
        mensaje,
      );
    });
  });

  it.each([
    ['cero', 0],
    ['no entera', 1.5],
    ['string', '2'],
  ])('cantidad %s → 400 INVALID_QUANTITY', async (_caso, cantidad) => {
    esperarError(
      await postOrder(app, pedido({ items: [item({ cantidad })] })),
      400,
      'INVALID_QUANTITY',
      'La cantidad de "Lomito completo" no es válida.',
    );
  });

  it('quitado fuera de ingredientesQuitables → 400 INVALID_REMOVED', async () => {
    esperarError(
      await postOrder(app, pedido({ items: [item({ quitados: ['cebolla'] })] })),
      400,
      'INVALID_REMOVED',
      'Hay ingredientes que no se pueden quitar de "Lomito completo".',
    );
  });

  describe('extra no disponible → 400 EXTRA_UNAVAILABLE', () => {
    const mensaje = 'Uno de los extras de "Lomito completo" no está disponible.';

    it('fuera de extrasIds', async () => {
      esperarError(
        await postOrder(
          app,
          pedido({ items: [item({ extras: [{ extraId: CEBOLLA_CARAMELIZADA, cantidad: 1 }] })] }),
        ),
        400,
        'EXTRA_UNAVAILABLE',
        mensaje,
      );
    });

    it.each([
      ['no disponible', { disponible: false }],
      ['inactivo', { activo: false }],
    ])('%s', async (_caso, cambios) => {
      await ExtraModel.updateOne({ _id: CHEDDAR }, { $set: cambios });
      esperarError(
        await postOrder(
          app,
          pedido({ items: [item({ extras: [{ extraId: CHEDDAR, cantidad: 1 }] })] }),
        ),
        400,
        'EXTRA_UNAVAILABLE',
        mensaje,
      );
    });
  });

  it.each([
    ['mayor a cantidadMax', 3],
    ['cero', 0],
    ['no entera', 1.5],
  ])('cantidad de extra %s → 400 INVALID_EXTRA_QUANTITY', async (_caso, cantidad) => {
    esperarError(
      await postOrder(app, pedido({ items: [item({ extras: [{ extraId: CHEDDAR, cantidad }] })] })),
      400,
      'INVALID_EXTRA_QUANTITY',
      'La cantidad de "Cheddar extra" no es válida.',
    );
  });

  it('aclaración de 141 caracteres → 400 INVALID_ACLARACION', async () => {
    esperarError(
      await postOrder(app, pedido({ aclaracion: 'a'.repeat(141) })),
      400,
      'INVALID_ACLARACION',
      'La aclaración no puede superar los 140 caracteres.',
    );
  });

  it.each([
    ['vacío', '   '],
    ['ausente', undefined],
  ])('nombre %s → 400 INVALID_NOMBRE', async (_caso, nombre) => {
    esperarError(
      await postOrder(app, pedido({ cliente: { nombre, telefono: nuevoTelefono() } })),
      400,
      'INVALID_NOMBRE',
      'Falta el nombre.',
    );
  });

  it.each([
    ['sin normalizar', '3364123456'],
    ['corto', '549336412345'],
    ['ausente', undefined],
  ])('teléfono %s → 400 INVALID_TELEFONO', async (_caso, telefono) => {
    esperarError(
      await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono } })),
      400,
      'INVALID_TELEFONO',
      'El teléfono no es válido.',
    );
  });

  it('método de pago inválido → 400 INVALID_METODO_PAGO', async () => {
    esperarError(
      await postOrder(app, pedido({ metodoPago: 'efectivo' })),
      400,
      'INVALID_METODO_PAGO',
      'El método de pago no es válido.',
    );
  });

  it.each([
    ['items vacío', { items: [] }],
    ['sin items', { items: undefined }],
  ])('%s → 400 EMPTY_ORDER', async (_caso, cambios) => {
    esperarError(
      await postOrder(app, pedido(cambios)),
      400,
      'EMPTY_ORDER',
      'El pedido no tiene productos.',
    );
  });

  it('sin body → 400 EMPTY_ORDER', async () => {
    esperarError(await postOrder(app, undefined), 400, 'EMPTY_ORDER');
  });

  it.each([
    ['fuera de la secuencia', '22:07'],
    ['fuera del horario', '12:00'],
    ['la de cierre', '00:30'],
    ['ausente', undefined],
  ])('hora %s → 400 INVALID_SLOT', async (_caso, hora) => {
    esperarError(
      await postOrder(app, pedido({ hora })),
      400,
      'INVALID_SLOT',
      'La franja elegida no existe para hoy.',
    );
  });

  it('franja sin la anticipación mínima → 400 SLOT_TOO_SOON', async () => {
    esperarError(
      await postOrder(app, pedido({ hora: '21:15' })),
      400,
      'SLOT_TOO_SOON',
      'La franja elegida ya no está disponible.',
    );
    expect((await postOrder(app, pedido({ hora: '21:30' }))).status).toBe(201);
  });

  it('franja cerrada → 409 SLOT_CLOSED', async () => {
    await PickupSlotModel.create({
      fecha: FECHA,
      hora: '22:00',
      inicio: new Date('2026-10-17T01:00:00.000Z'),
      cupoMax: 6,
      cerrada: true,
    });
    esperarError(
      await postOrder(app, pedido()),
      409,
      'SLOT_CLOSED',
      'La franja elegida está cerrada.',
    );
    expect(await ocupados()).toBe(0);
  });

  it('franja llena → 409 SLOT_FULL', async () => {
    await PickupSlotModel.create({
      fecha: FECHA,
      hora: '22:00',
      inicio: new Date('2026-10-17T01:00:00.000Z'),
      cupoMax: 1,
      ocupados: 1,
    });
    esperarError(
      await postOrder(app, pedido()),
      409,
      'SLOT_FULL',
      'La franja elegida ya no tiene cupo.',
    );
    expect(await ocupados()).toBe(1);
  });

  it('un pedido rechazado no crea customer, no reserva cupo ni toma número', async () => {
    const telefono = nuevoTelefono();
    await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono }, hora: '21:15' }));
    expect(await CustomerModel.countDocuments({ telefono })).toBe(0);
    expect(await PickupSlotModel.countDocuments()).toBe(0);
    expect(await CounterModel.countDocuments()).toBe(0);
  });
});

describe('concurrencia', () => {
  async function cincoEnParalelo() {
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => postOrder(app, pedido({ hora: '22:00' }))),
    );
    const ok = respuestas.filter((r) => r.status === 201);
    const llenas = respuestas.filter((r) => r.status === 409);
    expect(ok).toHaveLength(2);
    expect(llenas).toHaveLength(3);
    for (const r of llenas) expect(r.body.error.code).toBe('SLOT_FULL');
    expect(await ocupados()).toBe(2);
    expect(new Set(ok.map((r) => r.body.numero)).size).toBe(2);
    expect(await OrderModel.countDocuments()).toBe(2);
  }

  it('franja con cupoMax 2 y 5 pedidos a la vez: 2 entran y 3 dan SLOT_FULL', async () => {
    await PickupSlotModel.create({
      fecha: FECHA,
      hora: '22:00',
      inicio: new Date('2026-10-17T01:00:00.000Z'),
      cupoMax: 2,
    });
    await cincoEnParalelo();
  });

  it('lo mismo con la franja sin documento (el primer pedido la crea)', async () => {
    await SettingsModel.updateOne({}, { $set: { cupoMaxDefault: 2 } });
    await cincoEnParalelo();
    expect(await PickupSlotModel.countDocuments({ fecha: FECHA, hora: '22:00' })).toBe(1);
  });
});

describe('falla después de reservar', () => {
  it('insert que falla → 500 y ocupados vuelve al valor anterior; el número queda salteado', async () => {
    expect((await postOrder(app, pedido())).status).toBe(201);
    expect(await ocupados()).toBe(1);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(OrderModel.prototype, 'save').mockRejectedValueOnce(new Error('falla forzada'));
    const telefono = nuevoTelefono();
    const res = await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono } }));
    esperarError(res, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
    expect(await ocupados()).toBe(1);
    expect(await CustomerModel.countDocuments({ telefono })).toBe(0);

    vi.restoreAllMocks();
    const siguiente = await postOrder(app, pedido());
    expect(siguiente.body.numero).toBe(3);
  });

  it('upsert del customer que falla → 201, el pedido existe y el error va al log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(CustomerModel, 'updateOne').mockRejectedValueOnce(new Error('falla forzada'));
    const telefono = nuevoTelefono();
    const res = await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono } }));

    expect(res.status).toBe(201);
    expect(await OrderModel.exists({ codigo: res.body.codigo })).toBeTruthy();
    expect(await ocupados()).toBe(1);
    expect(await CustomerModel.countDocuments({ telefono })).toBe(0);
    expect(log).toHaveBeenCalledOnce();
  });

  it('codigo repetido: se reintenta con otro', async () => {
    // Las primeras 8 llamadas arman `AAAAAAAA`; el segundo pedido choca una vez y reintenta.
    randomIntMock.mockImplementation(() => 0);
    const primero = await postOrder(app, pedido());
    expect(primero.body.codigo).toBe('AAAAAAAA');

    let llamadas = 0;
    randomIntMock.mockImplementation((max) => (++llamadas <= 8 ? 0 : (llamadas * 7) % max));
    const segundo = await postOrder(app, pedido());
    expect(segundo.status).toBe(201);
    expect(segundo.body.codigo).toMatch(CODIGO);
    expect(segundo.body.codigo).not.toBe('AAAAAAAA');
    expect(llamadas).toBe(16);
  });

  it('codigo que choca en todos los intentos → 500 y libera el cupo', async () => {
    randomIntMock.mockImplementation(() => 0);
    expect((await postOrder(app, pedido())).status).toBe(201);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    esperarError(await postOrder(app, pedido()), 500, 'INTERNAL_ERROR');
    expect(await ocupados()).toBe(1);
    // 1 intento + 5 reintentos.
    expect(randomIntMock).toHaveBeenCalledTimes(8 + 6 * 8);
  });
});

describe('topes anti-spam', () => {
  it('tercer pedido pendiente del mismo teléfono → 429; si cancela uno, el siguiente pasa', async () => {
    const cliente = { nombre: 'Ana', telefono: nuevoTelefono() };
    const primero = await postOrder(app, pedido({ cliente }));
    expect((await postOrder(app, pedido({ cliente }))).status).toBe(201);

    esperarError(
      await postOrder(app, pedido({ cliente })),
      429,
      'TOO_MANY_ORDERS',
      'Ya tenés 2 pedidos en curso. Esperá a que los confirmen o cancelá uno.',
    );
    // El tope por teléfono no reserva cupo ni toma número.
    expect(await ocupados()).toBe(2);

    await request(app).post(`/api/orders/${primero.body.codigo}/cancelar`);
    expect((await postOrder(app, pedido({ cliente }))).status).toBe(201);
  });

  it('los confirmados no cuentan como pendientes', async () => {
    const cliente = { nombre: 'Ana', telefono: nuevoTelefono() };
    await postOrder(app, pedido({ cliente }));
    await postOrder(app, pedido({ cliente }));
    await OrderModel.updateMany({ 'cliente.telefono': cliente.telefono }, { estado: 'confirmado' });
    expect((await postOrder(app, pedido({ cliente }))).status).toBe(201);
  });

  it('una transferencia vencida no cuenta (vencimiento perezoso antes de contar)', async () => {
    const cliente = { nombre: 'Ana', telefono: nuevoTelefono() };
    await postOrder(app, pedido({ cliente, metodoPago: 'transferencia' }));
    await postOrder(app, pedido({ cliente, metodoPago: 'transferencia', hora: '22:30' }));
    avanzarReloj(15 * MIN);
    expect((await postOrder(app, pedido({ cliente, hora: '22:30' }))).status).toBe(201);
  });

  it(`pedido ${ORDER_MAX_POR_IP + 1} de la misma IP en una hora → 429 con Retry-After; pasada la hora, pasa`, async () => {
    const ip = nuevaIp();
    const horas = ['22:30', '22:45', '23:00', '23:15'];
    for (let i = 0; i < ORDER_MAX_POR_IP; i++) {
      const res = await postOrder(app, pedido({ hora: horas[i % horas.length] }), ip);
      expect(res.status).toBe(201);
    }

    avanzarReloj(10 * MIN);
    const res = await postOrder(app, pedido({ hora: '23:30' }), ip);
    esperarError(
      res,
      429,
      'TOO_MANY_ORDERS',
      'Hiciste muchos pedidos seguidos. Probá de nuevo más tarde.',
    );
    expect(res.headers['retry-after']).toBe(String(50 * 60));
    expect(await ocupados('23:30')).toBe(0);

    // Otra IP no se ve afectada.
    expect((await postOrder(app, pedido({ hora: '23:30' }), nuevaIp())).status).toBe(201);

    avanzarReloj(50 * MIN); // 22:00: se cumple la hora desde el primero
    expect((await postOrder(app, pedido({ hora: '23:30' }), ip)).status).toBe(201);
  });

  it('los pedidos rechazados no suman al tope por IP', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < ORDER_MAX_POR_IP; i++) {
      expect((await postOrder(app, pedido({ hora: '21:15' }), ip)).status).toBe(400);
    }
    expect((await postOrder(app, pedido(), ip)).status).toBe(201);
  });
});
