import { Types } from 'mongoose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_MODELS,
  CustomerModel,
  OrderModel,
  PickupSlotModel,
  UserModel,
} from '../src/models';
import { clearDb, useTestDb } from './db';

useTestDb();

beforeAll(async () => {
  await Promise.all(ALL_MODELS.map((model) => model.syncIndexes()));
});

beforeEach(clearDb);

function order(overrides: Record<string, unknown> = {}) {
  return {
    codigo: 'ABCD2345',
    numero: 1,
    fecha: '2026-10-10',
    cliente: { nombre: 'Juan', telefono: '5493364123456' },
    items: [
      {
        productoId: new Types.ObjectId(),
        nombre: 'Lomito completo',
        precioUnitario: 14500,
        cantidad: 1,
        subtotal: 14500,
      },
    ],
    slotId: new Types.ObjectId(),
    horaRetiro: '21:00',
    metodoPago: 'retiro' as const,
    total: 14500,
    ...overrides,
  };
}

const duplicado = { code: 11000 };

describe('índices únicos', () => {
  it('orders.codigo', async () => {
    await OrderModel.create(order());
    await expect(OrderModel.create(order({ numero: 2 }))).rejects.toMatchObject(duplicado);
  });

  it('orders (fecha, numero)', async () => {
    await OrderModel.create(order());
    await expect(OrderModel.create(order({ codigo: 'WXYZ6789' }))).rejects.toMatchObject(
      duplicado,
    );
    // Mismo número en otra jornada: permitido.
    await expect(
      OrderModel.create(order({ codigo: 'WXYZ6789', fecha: '2026-10-11' })),
    ).resolves.toBeDefined();
  });

  it('pickupSlots (fecha, hora)', async () => {
    const slot = { fecha: '2026-10-10', hora: '21:00', inicio: new Date(), cupoMax: 6 };
    await PickupSlotModel.create(slot);
    await expect(PickupSlotModel.create(slot)).rejects.toMatchObject(duplicado);
  });

  it('customers.telefono', async () => {
    const customer = { telefono: '5493364123456', nombre: 'Juan', nombreBusqueda: 'juan' };
    await CustomerModel.create(customer);
    await expect(CustomerModel.create({ ...customer, nombre: 'Otro' })).rejects.toMatchObject(
      duplicado,
    );
  });

  it('users.usuario', async () => {
    const user = { nombre: 'Admin', usuario: 'admin', passwordHash: 'hash' };
    await UserModel.create(user);
    await expect(UserModel.create(user)).rejects.toMatchObject(duplicado);
  });
});

describe('defaults de §3', () => {
  it('order nuevo: pendiente y campos nulos', async () => {
    const doc = await OrderModel.create(order());
    expect(doc.estado).toBe('pendiente');
    expect(doc.motivoCancelacion).toBeNull();
    expect(doc.expiresAt).toBeNull();
    expect(doc.aclaracion).toBeNull();
    expect(doc.items[0]?.quitados).toEqual([]);
    expect(doc.items[0]?.extras).toEqual([]);
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('order sin ítems o con enum inválido es rechazado', async () => {
    await expect(OrderModel.create(order({ items: [] }))).rejects.toThrow(/al menos 1 ítem/);
    await expect(OrderModel.create(order({ estado: 'otro' }))).rejects.toThrow();
  });
});
