import type { Customer } from '@blackstation/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { setClock } from '../src/lib/clock';
import { normalizarBusqueda } from '../src/lib/texto';
import { CustomerModel } from '../src/models';
import { clearDb, useTestDb } from './db';
import { ABIERTO, MIN, authAdmin, fijarReloj } from './pedidos';

useTestDb();

const app = createApp();

beforeEach(async () => {
  fijarReloj(ABIERTO);
  await clearDb();
});

afterEach(() => {
  setClock(null);
});

const buscar = (q?: string) =>
  request(app)
    .get('/api/admin/customers')
    .query(q === undefined ? {} : { q })
    .set('Authorization', authAdmin);
const editar = (telefono: string, body: unknown) =>
  request(app)
    .patch(`/api/admin/customers/${telefono}`)
    .set('Authorization', authAdmin)
    .send(body as object);

const iso = (ms: number) => new Date(ms).toISOString();
const telefonos = (res: request.Response) => res.body.customers.map((c: Customer) => c.telefono);

let n = 0;
async function cliente(nombre: string, cambios: Record<string, unknown> = {}) {
  const doc = await CustomerModel.create({
    telefono: `549336${String(4_000_000 + ++n).padStart(7, '0')}`,
    nombre,
    nombreBusqueda: normalizarBusqueda(nombre),
    pedidosTotal: 1,
    ultimoPedidoAt: new Date(ABIERTO - n * MIN),
    ...cambios,
  });
  return doc.telefono;
}

describe('GET /api/admin/customers', () => {
  it('sin token → 401', async () => {
    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('?q=juan encuentra a "Juán Pérez" (sin tildes ni mayúsculas)', async () => {
    const juan = await cliente('Juán Pérez');
    await cliente('María Gómez');
    const res = await buscar('juan');
    expect(res.status).toBe(200);
    expect(telefonos(res)).toEqual([juan]);
    expect((await buscar('PÉREZ')).body.customers).toHaveLength(1);
  });

  it('?q=336 busca por teléfono (contiene)', async () => {
    const a = await cliente('Ana', { telefono: '5493364123456' });
    await cliente('Beto', { telefono: '5491155554444' });
    expect(telefonos(await buscar('336'))).toEqual([a]);
    expect(telefonos(await buscar('4123'))).toEqual([a]);
  });

  it.each(['a', ' a ', '1'])('?q=%j → 400 VALIDATION_ERROR', async (q) => {
    const res = await buscar(q);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'La búsqueda necesita al menos 2 caracteres.',
    });
  });

  it('?q= vacío → como sin q', async () => {
    await cliente('Ana');
    await cliente('Beto');
    expect((await buscar('')).body.customers).toHaveLength(2);
  });

  it('?q=.* no rompe: se busca como texto literal', async () => {
    await cliente('Ana');
    const literal = await cliente('Ana.*Beto');
    const res = await buscar('.*');
    expect(res.status).toBe(200);
    expect(telefonos(res)).toEqual([literal]);
    expect((await buscar('(a')).status).toBe(200);
  });

  it('orden por ultimoPedidoAt desc (los null al final) y tope de 50', async () => {
    const sinPedido = await cliente('Sin pedido', { ultimoPedidoAt: null });
    const docs = [];
    for (let i = 0; i < 55; i++) docs.push(await cliente(`Cliente ${i}`));
    const reciente = await cliente('Reciente', { ultimoPedidoAt: new Date(ABIERTO + MIN) });

    const res = await buscar();
    expect(res.body.customers).toHaveLength(50);
    expect(telefonos(res)[0]).toBe(reciente);
    expect(telefonos(res).slice(1, 4)).toEqual(docs.slice(0, 3));
    expect(telefonos(res)).not.toContain(sinPedido);

    const todos = await buscar('cliente');
    expect(todos.body.customers).toHaveLength(50);
    const conNull = await buscar('pedido');
    expect(telefonos(conNull)).toEqual([sinPedido]);
  });

  it('los null quedan después de los que tienen ultimoPedidoAt', async () => {
    const sinPedido = await cliente('Ana sin pedido', { ultimoPedidoAt: null });
    const con = await cliente('Ana con pedido');
    expect(telefonos(await buscar('ana'))).toEqual([con, sinPedido]);
  });

  it('la respuesta es el Customer, sin nombreBusqueda', async () => {
    const telefono = await cliente('Juán Pérez');
    const res = await buscar();
    expect(res.body.customers[0]).toEqual({
      _id: expect.any(String),
      telefono,
      nombre: 'Juán Pérez',
      pedidosTotal: 1,
      entregados: 0,
      noShows: 0,
      estado: 'normal',
      estadoManual: false,
      ultimoPedidoAt: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.customers[0]).not.toHaveProperty('nombreBusqueda');
  });
});

describe('PATCH /api/admin/customers/:telefono', () => {
  it('sin token → 401', async () => {
    const telefono = await cliente('Ana');
    const res = await request(app)
      .patch(`/api/admin/customers/${telefono}`)
      .send({ estado: 'bloqueado' });
    expect(res.status).toBe(401);
  });

  it('cambiar estado → estadoManual: true', async () => {
    const telefono = await cliente('Ana');
    fijarReloj(ABIERTO + MIN);
    const res = await editar(telefono, { estado: 'bloqueado' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      telefono,
      estado: 'bloqueado',
      estadoManual: true,
      updatedAt: iso(ABIERTO + MIN),
    });
    expect(res.body).not.toHaveProperty('nombreBusqueda');
  });

  it('cambiar estado con estadoManual: false → queda en false', async () => {
    const telefono = await cliente('Ana', { estadoManual: true });
    const res = await editar(telefono, { estado: 'requiereTransferencia', estadoManual: false });
    expect(res.body).toMatchObject({ estado: 'requiereTransferencia', estadoManual: false });
  });

  it('solo estadoManual → cambia solo eso', async () => {
    const telefono = await cliente('Ana', { estado: 'bloqueado', estadoManual: true });
    const res = await editar(telefono, { estadoManual: false });
    expect(res.body).toMatchObject({ estado: 'bloqueado', estadoManual: false });
  });

  it.each([
    ['body sin cambios', {}, 'No hay cambios para aplicar.'],
    ['estado inválido', { estado: 'vip' }, 'El estado no es válido.'],
    [
      'estadoManual no boolean',
      { estadoManual: 'si' },
      '`estadoManual` tiene que ser true o false.',
    ],
  ])('%s → 400 VALIDATION_ERROR', async (_caso, body, message) => {
    const telefono = await cliente('Ana');
    const res = await editar(telefono, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message });
  });

  it.each([
    ['inexistente', '5493369999999'],
    ['sin formato', '0336-15-4123'],
  ])('teléfono %s → 404 CUSTOMER_NOT_FOUND', async (_caso, telefono) => {
    const res = await editar(telefono, { estado: 'bloqueado' });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'CUSTOMER_NOT_FOUND',
      message: 'No encontramos ese cliente.',
    });
  });
});
