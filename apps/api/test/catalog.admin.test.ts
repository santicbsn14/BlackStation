import type { Category, Extra, Product } from '@blackstation/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { CategoryModel, ExtraModel, ProductModel } from '../src/models';
import { runSeed } from '../src/seed/runSeed';
import { clearDb, useTestDb } from './db';

useTestDb();

const app = createApp();
const token = jwt.sign({ sub: '66f1d0000000000000000099', rol: 'admin' }, getEnv().JWT_SECRET, {
  expiresIn: '12h',
});
const auth = `Bearer ${token}`;

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
const llamar = (metodo: Metodo, url: string, body?: unknown) => {
  const req = request(app)[metodo](url).set('Authorization', auth);
  return body === undefined ? req : req.send(body as object);
};

// Fixtures del seed --demo.
const CATEGORIA = '66f1a0000000000000000001';
const PRODUCTO = '66f1c0000000000000000001';
const EXTRA = '66f1b0000000000000000001';
const INEXISTENTE = '66f1ffffffffffffffffffff';

const CLOUD = getEnv().CLOUDINARY_CLOUD_NAME;
const foto = (nombre: string) => ({
  fotoUrl: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/blackstation/products/${nombre}.jpg`,
  fotoPublicId: `blackstation/products/${nombre}`,
});

const T0 = new Date('2026-10-16T21:00:00.000Z');
const T1 = new Date('2026-10-16T21:05:00.000Z');

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(async () => {
  await clearDb();
  await runSeed({
    demo: true,
    admin: { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' },
  });
  setClock(() => T0);
  fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ result: 'ok' }, { status: 200 }));
});

afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
});

function esperarError(res: request.Response, status: number, code: string, message: string) {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: { code, message } });
}

const validacion = (res: request.Response, message: string) =>
  esperarError(res, 400, 'VALIDATION_ERROR', message);

/** Llamadas a `image/destroy` con el `public_id` que mandaron. */
function destroys(): string[] {
  return fetchSpy.mock.calls.map(([url, init]) => {
    expect(String(url)).toBe(`https://api.cloudinary.com/v1_1/${CLOUD}/image/destroy`);
    return new URLSearchParams(String(init?.body)).get('public_id') ?? '';
  });
}

describe('sin token', () => {
  const rutas: [Metodo, string][] = [
    ['get', '/api/admin/categories'],
    ['post', '/api/admin/categories'],
    ['put', `/api/admin/categories/${CATEGORIA}`],
    ['delete', `/api/admin/categories/${CATEGORIA}`],
    ['get', '/api/admin/products'],
    ['post', '/api/admin/products'],
    ['put', `/api/admin/products/${PRODUCTO}`],
    ['delete', `/api/admin/products/${PRODUCTO}`],
    ['patch', `/api/admin/products/${PRODUCTO}/disponible`],
    ['get', '/api/admin/extras'],
    ['post', '/api/admin/extras'],
    ['put', `/api/admin/extras/${EXTRA}`],
    ['delete', `/api/admin/extras/${EXTRA}`],
    ['patch', `/api/admin/extras/${EXTRA}/disponible`],
    ['post', '/api/admin/uploads/signature'],
  ];

  it.each(rutas)('%s %s → 401', async (metodo, url) => {
    const res = await request(app)[metodo](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('categorías', () => {
  it('GET lista todas (incluye inactivas) por (orden, _id)', async () => {
    await CategoryModel.updateOne({ _id: '66f1a0000000000000000004' }, { activa: false, orden: 1 });
    const res = await llamar('get', '/api/admin/categories');
    expect(res.status).toBe(200);
    const categories = res.body.categories as Category[];
    expect(categories.map((c) => c._id)).toEqual([
      '66f1a0000000000000000001',
      '66f1a0000000000000000004',
      '66f1a0000000000000000002',
      '66f1a0000000000000000003',
    ]);
    expect(categories[1]?.activa).toBe(false);
  });

  it('POST → 201 con defaults', async () => {
    const res = await llamar('post', '/api/admin/categories', { nombre: '  Postres ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      _id: expect.stringMatching(/^[0-9a-f]{24}$/),
      nombre: 'Postres',
      orden: 0,
      activa: true,
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
    expect(await CategoryModel.countDocuments()).toBe(5);
  });

  it('PUT parcial cambia solo lo enviado y actualiza updatedAt', async () => {
    setClock(() => T1);
    const res = await llamar('put', `/api/admin/categories/${CATEGORIA}`, { orden: 9 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: CATEGORIA,
      nombre: 'Lomitos',
      orden: 9,
      activa: true,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: T1.toISOString(),
    });
  });

  it('DELETE es soft y PUT activa: true reactiva', async () => {
    const del = await llamar('delete', `/api/admin/categories/${CATEGORIA}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });
    expect((await CategoryModel.findById(CATEGORIA).lean())?.activa).toBe(false);

    const put = await llamar('put', `/api/admin/categories/${CATEGORIA}`, { activa: true });
    expect(put.status).toBe(200);
    expect(put.body.activa).toBe(true);
  });

  it('validaciones', async () => {
    validacion(await llamar('post', '/api/admin/categories', {}), 'Falta el nombre.');
    validacion(await llamar('post', '/api/admin/categories', { nombre: '  ' }), 'Falta el nombre.');
    validacion(
      await llamar('post', '/api/admin/categories', { nombre: 'X', orden: -1 }),
      'El orden tiene que ser un entero mayor o igual a 0.',
    );
    validacion(
      await llamar('put', `/api/admin/categories/${CATEGORIA}`, { activa: 'si' }),
      '`activa` tiene que ser true o false.',
    );
  });

  it(':id inexistente o mal formado → 404', async () => {
    for (const id of [INEXISTENTE, 'no-es-un-id']) {
      esperarError(
        await llamar('put', `/api/admin/categories/${id}`, { nombre: 'X' }),
        404,
        'NOT_FOUND',
        'No encontramos esa categoría.',
      );
      esperarError(
        await llamar('delete', `/api/admin/categories/${id}`),
        404,
        'NOT_FOUND',
        'No encontramos esa categoría.',
      );
    }
  });
});

describe('productos', () => {
  const nuevo = { nombre: 'Choripán', categoriaId: CATEGORIA, precio: 5000 };

  it('GET lista todos (incluye inactivos) por (orden, _id)', async () => {
    const res = await llamar('get', '/api/admin/products');
    expect(res.status).toBe(200);
    const products = res.body.products as Product[];
    expect(products).toHaveLength(13);
    expect(products.map((p) => p.orden)).toEqual(
      products.map((p) => p.orden).sort((a, b) => a - b),
    );
    expect(products.find((p) => p._id === '66f1c0000000000000000013')?.activo).toBe(false);
    // Empates de orden: por _id.
    expect(products.slice(0, 4).map((p) => p._id)).toEqual([
      '66f1c0000000000000000001',
      '66f1c0000000000000000004',
      '66f1c0000000000000000007',
      '66f1c0000000000000000010',
    ]);
  });

  it('POST → 201 con defaults', async () => {
    const res = await llamar('post', '/api/admin/products', nuevo);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      _id: expect.stringMatching(/^[0-9a-f]{24}$/),
      nombre: 'Choripán',
      descripcion: '',
      categoriaId: CATEGORIA,
      precio: 5000,
      fotoUrl: null,
      fotoPublicId: null,
      disponible: true,
      activo: true,
      orden: 0,
      ingredientesQuitables: [],
      extrasIds: [],
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
  });

  it('POST con todo: trim y sin repetidos', async () => {
    const res = await llamar('post', '/api/admin/products', {
      ...nuevo,
      descripcion: ' Con chimichurri ',
      orden: 3,
      ingredientesQuitables: [' cebolla', 'cebolla ', 'tomate'],
      extrasIds: [EXTRA, '66f1b0000000000000000002', EXTRA],
      ...foto('chori'),
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      descripcion: 'Con chimichurri',
      orden: 3,
      ingredientesQuitables: ['cebolla', 'tomate'],
      extrasIds: [EXTRA, '66f1b0000000000000000002'],
      ...foto('chori'),
    });
  });

  it('acepta una categoría inactiva', async () => {
    await CategoryModel.updateOne({ _id: CATEGORIA }, { activa: false });
    expect((await llamar('post', '/api/admin/products', nuevo)).status).toBe(201);
  });

  it('PUT parcial cambia solo lo enviado y actualiza updatedAt', async () => {
    const antes = (await ProductModel.findById(PRODUCTO).lean())!;
    setClock(() => T1);
    const res = await llamar('put', `/api/admin/products/${PRODUCTO}`, { precio: 15000 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: PRODUCTO,
      nombre: antes.nombre,
      descripcion: antes.descripcion,
      precio: 15000,
      ingredientesQuitables: antes.ingredientesQuitables,
      extrasIds: antes.extrasIds.map(String),
      updatedAt: T1.toISOString(),
      createdAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('DELETE es soft, no borra la foto, y PUT activo: true reactiva', async () => {
    await ProductModel.updateOne({ _id: PRODUCTO }, foto('vieja'));
    const del = await llamar('delete', `/api/admin/products/${PRODUCTO}`);
    expect(del.body).toEqual({ ok: true });
    const doc = await ProductModel.findById(PRODUCTO).lean();
    expect(doc?.activo).toBe(false);
    expect(doc?.fotoPublicId).toBe('blackstation/products/vieja');
    expect(fetchSpy).not.toHaveBeenCalled();

    const put = await llamar('put', `/api/admin/products/${PRODUCTO}`, { activo: true });
    expect(put.body.activo).toBe(true);
  });

  it('PATCH disponible cambia solo disponible', async () => {
    setClock(() => T1);
    const res = await llamar('patch', `/api/admin/products/${PRODUCTO}/disponible`, {
      disponible: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      disponible: false,
      activo: true,
      precio: 14500,
      updatedAt: T1.toISOString(),
    });
    validacion(
      await llamar('patch', `/api/admin/products/${PRODUCTO}/disponible`, { disponible: 'si' }),
      '`disponible` tiene que ser true o false.',
    );
  });

  describe('validaciones', () => {
    it.each([
      ['falta el nombre', { categoriaId: CATEGORIA, precio: 1 }, 'Falta el nombre.'],
      ['falta la categoría', { nombre: 'X', precio: 1 }, 'Falta la categoría.'],
      ['falta el precio', { nombre: 'X', categoriaId: CATEGORIA }, 'Falta el precio.'],
      ['faltan todos: el primero', {}, 'Falta el nombre.'],
      ['nombre vacío', { ...nuevo, nombre: ' ' }, 'Falta el nombre.'],
      [
        'precio negativo',
        { ...nuevo, precio: -1 },
        'El precio tiene que ser un entero mayor o igual a 0.',
      ],
      [
        'precio decimal',
        { ...nuevo, precio: 10.5 },
        'El precio tiene que ser un entero mayor o igual a 0.',
      ],
      ['orden -1', { ...nuevo, orden: -1 }, 'El orden tiene que ser un entero mayor o igual a 0.'],
      ['descripción no string', { ...nuevo, descripcion: 5 }, 'La descripción no es válida.'],
      ['categoría inexistente', { ...nuevo, categoriaId: INEXISTENTE }, 'La categoría no existe.'],
      ['categoría mal formada', { ...nuevo, categoriaId: 'abc' }, 'La categoría no existe.'],
      [
        'extra inexistente',
        { ...nuevo, extrasIds: [EXTRA, INEXISTENTE] },
        'Uno de los extras no existe.',
      ],
      ['extra mal formado', { ...nuevo, extrasIds: ['abc'] }, 'Uno de los extras no existe.'],
      [
        'ingrediente vacío',
        { ...nuevo, ingredientesQuitables: ['cebolla', ' '] },
        'Los ingredientes quitables tienen que ser textos no vacíos.',
      ],
    ])('POST %s', async (_caso, body, message) => {
      validacion(await llamar('post', '/api/admin/products', body), message);
    });

    it.each([
      ['nombre vacío', { nombre: '' }, 'Falta el nombre.'],
      ['categoría inexistente', { categoriaId: INEXISTENTE }, 'La categoría no existe.'],
      ['categoría null', { categoriaId: null }, 'La categoría no existe.'],
      ['extra inexistente', { extrasIds: [INEXISTENTE] }, 'Uno de los extras no existe.'],
      ['activo no boolean', { activo: 'si' }, '`activo` tiene que ser true o false.'],
    ])('PUT %s', async (_caso, body, message) => {
      validacion(await llamar('put', `/api/admin/products/${PRODUCTO}`, body), message);
    });
  });

  it(':id inexistente o mal formado → 404', async () => {
    for (const id of [INEXISTENTE, 'no-es-un-id']) {
      for (const [metodo, url, body] of [
        ['put', `/api/admin/products/${id}`, { nombre: 'X' }],
        ['delete', `/api/admin/products/${id}`, undefined],
        ['patch', `/api/admin/products/${id}/disponible`, { disponible: true }],
      ] as const) {
        esperarError(
          await llamar(metodo, url, body),
          404,
          'NOT_FOUND',
          'No encontramos ese producto.',
        );
      }
    }
  });

  describe('fotos', () => {
    it.each([
      ['fotoUrl sin fotoPublicId', { fotoUrl: foto('a').fotoUrl }],
      ['fotoPublicId sin fotoUrl', { fotoPublicId: foto('a').fotoPublicId }],
      ['uno null y el otro string', { fotoUrl: null, fotoPublicId: foto('a').fotoPublicId }],
      ['publicId de otra carpeta', { ...foto('a'), fotoPublicId: 'otra/carpeta/a' }],
      [
        'URL de otra cuenta',
        { ...foto('a'), fotoUrl: 'https://res.cloudinary.com/otra/image/upload/v1/a.jpg' },
      ],
      ['fotoUrl no string', { fotoUrl: 5, fotoPublicId: 'blackstation/products/a' }],
    ])('%s → 400 Foto inválida.', async (_caso, body) => {
      validacion(await llamar('put', `/api/admin/products/${PRODUCTO}`, body), 'Foto inválida.');
      validacion(
        await llamar('post', '/api/admin/products', { ...nuevo, ...body }),
        'Foto inválida.',
      );
    });

    it('un PUT que cambia la foto borra la vieja', async () => {
      await ProductModel.updateOne({ _id: PRODUCTO }, foto('vieja'));
      const res = await llamar('put', `/api/admin/products/${PRODUCTO}`, foto('nueva'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(foto('nueva'));
      await vi.waitFor(() => expect(destroys()).toEqual(['blackstation/products/vieja']));
    });

    it('un PUT que la pone en null también la borra', async () => {
      await ProductModel.updateOne({ _id: PRODUCTO }, foto('vieja'));
      const res = await llamar('put', `/api/admin/products/${PRODUCTO}`, {
        fotoUrl: null,
        fotoPublicId: null,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fotoUrl: null, fotoPublicId: null });
      await vi.waitFor(() => expect(destroys()).toEqual(['blackstation/products/vieja']));
    });

    it('un PUT sin cambio de foto no borra nada', async () => {
      await ProductModel.updateOne({ _id: PRODUCTO }, foto('vieja'));
      await llamar('put', `/api/admin/products/${PRODUCTO}`, { ...foto('vieja'), precio: 1 });
      await llamar('put', `/api/admin/products/${PRODUCTO}`, { precio: 2 });
      // Sin foto previa, poner una no borra nada.
      await llamar('put', '/api/admin/products/66f1c0000000000000000002', foto('primera'));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['fetch rechaza', () => fetchSpy.mockRejectedValue(new Error('sin red'))],
      [
        'Cloudinary responde 500',
        () => fetchSpy.mockResolvedValue(new Response('', { status: 500 })),
      ],
    ])('si el destroy falla (%s) la respuesta sigue siendo 200', async (_caso, preparar) => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      preparar();
      await ProductModel.updateOne({ _id: PRODUCTO }, foto('vieja'));
      const res = await llamar('put', `/api/admin/products/${PRODUCTO}`, foto('nueva'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(foto('nueva'));
      await vi.waitFor(() => expect(errorLog).toHaveBeenCalled());
      expect(destroys()).toEqual(['blackstation/products/vieja']);
    });
  });
});

describe('extras', () => {
  it('GET lista todos (incluye inactivos) por createdAt', async () => {
    setClock(() => T1);
    const creado = await llamar('post', '/api/admin/extras', { nombre: 'Provoleta', precio: 1 });
    await ExtraModel.updateOne({ _id: EXTRA }, { activo: false });
    const res = await llamar('get', '/api/admin/extras');
    expect(res.status).toBe(200);
    const extras = res.body.extras as Extra[];
    expect(extras).toHaveLength(6);
    expect(extras.at(-1)?._id).toBe(creado.body._id);
    expect(extras[0]).toMatchObject({ _id: EXTRA, activo: false });
  });

  it('POST → 201 con defaults', async () => {
    const res = await llamar('post', '/api/admin/extras', { nombre: ' Provoleta ', precio: 2000 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      _id: expect.stringMatching(/^[0-9a-f]{24}$/),
      nombre: 'Provoleta',
      precio: 2000,
      disponible: true,
      cantidadMax: 1,
      activo: true,
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
  });

  it('PUT parcial cambia solo lo enviado y actualiza updatedAt', async () => {
    setClock(() => T1);
    const res = await llamar('put', `/api/admin/extras/${EXTRA}`, { cantidadMax: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: EXTRA,
      nombre: 'Cheddar extra',
      precio: 1200,
      cantidadMax: 3,
      updatedAt: T1.toISOString(),
    });
  });

  it('DELETE es soft y PUT activo: true reactiva', async () => {
    const del = await llamar('delete', `/api/admin/extras/${EXTRA}`);
    expect(del.body).toEqual({ ok: true });
    expect((await ExtraModel.findById(EXTRA).lean())?.activo).toBe(false);
    const put = await llamar('put', `/api/admin/extras/${EXTRA}`, { activo: true });
    expect(put.body.activo).toBe(true);
  });

  it('PATCH disponible cambia solo disponible', async () => {
    const res = await llamar('patch', `/api/admin/extras/${EXTRA}/disponible`, {
      disponible: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ disponible: false, activo: true, precio: 1200 });
    validacion(
      await llamar('patch', `/api/admin/extras/${EXTRA}/disponible`, { disponible: 'si' }),
      '`disponible` tiene que ser true o false.',
    );
    validacion(
      await llamar('patch', `/api/admin/extras/${EXTRA}/disponible`, {}),
      '`disponible` tiene que ser true o false.',
    );
  });

  it('validaciones', async () => {
    validacion(await llamar('post', '/api/admin/extras', { precio: 1 }), 'Falta el nombre.');
    validacion(await llamar('post', '/api/admin/extras', { nombre: 'X' }), 'Falta el precio.');
    validacion(
      await llamar('post', '/api/admin/extras', { nombre: 'X', precio: -5 }),
      'El precio tiene que ser un entero mayor o igual a 0.',
    );
    validacion(
      await llamar('post', '/api/admin/extras', { nombre: 'X', precio: 1, cantidadMax: 0 }),
      'La cantidad máxima tiene que ser 1 o más.',
    );
    validacion(
      await llamar('put', `/api/admin/extras/${EXTRA}`, { nombre: '' }),
      'Falta el nombre.',
    );
    validacion(
      await llamar('put', `/api/admin/extras/${EXTRA}`, { precio: 1.5 }),
      'El precio tiene que ser un entero mayor o igual a 0.',
    );
  });

  it(':id inexistente o mal formado → 404', async () => {
    for (const id of [INEXISTENTE, 'no-es-un-id']) {
      for (const [metodo, url, body] of [
        ['put', `/api/admin/extras/${id}`, { nombre: 'X' }],
        ['delete', `/api/admin/extras/${id}`, undefined],
        ['patch', `/api/admin/extras/${id}/disponible`, { disponible: true }],
      ] as const) {
        esperarError(
          await llamar(metodo, url, body),
          404,
          'NOT_FOUND',
          'No encontramos ese extra.',
        );
      }
    }
  });
});
