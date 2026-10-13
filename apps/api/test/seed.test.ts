import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CategoryModel,
  CustomerModel,
  ExtraModel,
  ProductModel,
  SettingsModel,
  UserModel,
} from '../src/models';
import { runSeed, type SeedOptions } from '../src/seed/runSeed';
import { clearDb, useTestDb } from './db';

useTestDb();

beforeEach(clearDb);

const admin = { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' };
const base: SeedOptions = { demo: false, admin };

describe('seed', () => {
  it('dos corridas → 1 settings y 1 usuario', async () => {
    const primera = await runSeed(base);
    const segunda = await runSeed(base);
    expect(primera.settingsCreado).toBe(true);
    expect(segunda.settingsCreado).toBe(false);
    expect(await SettingsModel.countDocuments()).toBe(1);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('crea settings con los defaults de §3.7', async () => {
    await runSeed(base);
    const settings = await SettingsModel.findOne().lean();
    expect(settings).toMatchObject({
      intervaloMin: 15,
      cupoMaxDefault: 6,
      anticipacionMinMin: 30,
      minutosTransferencia: 15,
      pedidosHabilitados: true,
      alias: 'BLACKSTATION.ALIAS',
      telefonoLocal: '5493360000000',
    });
    expect(settings?.horarios).toHaveLength(7);
    expect(settings?.horarios.find((h) => h.dia === 1)?.activo).toBe(false);
  });

  it('no pisa un settings editado', async () => {
    await runSeed(base);
    await SettingsModel.updateOne({}, { $set: { alias: 'ALIAS.REAL', cupoMaxDefault: 10 } });
    await runSeed(base);
    const settings = await SettingsModel.findOne().lean();
    expect(settings?.alias).toBe('ALIAS.REAL');
    expect(settings?.cupoMaxDefault).toBe(10);
  });

  it('guarda el password hasheado y lo actualiza en cada corrida', async () => {
    await runSeed(base);
    const user = await UserModel.findOne({ usuario: 'admin' }).lean();
    expect(user?.passwordHash).not.toBe(admin.password);
    expect(await bcrypt.compare(admin.password, user?.passwordHash ?? '')).toBe(true);
    expect(user).toMatchObject({ nombre: 'Black Station', rol: 'admin', activo: true });

    await runSeed({ ...base, admin: { ...admin, password: 'otra-clave' } });
    const actualizado = await UserModel.findOne({ usuario: 'admin' }).lean();
    expect(await bcrypt.compare('otra-clave', actualizado?.passwordHash ?? '')).toBe(true);
  });

  it('--demo carga el catálogo una sola vez, con los _id de los mocks', async () => {
    const primera = await runSeed({ ...base, demo: true });
    expect(primera.demoCargado).toEqual(['categories', 'products', 'extras', 'customers']);
    const cantidades = {
      categories: await CategoryModel.countDocuments(),
      products: await ProductModel.countDocuments(),
      extras: await ExtraModel.countDocuments(),
      customers: await CustomerModel.countDocuments(),
    };
    expect(cantidades.categories).toBeGreaterThan(0);
    expect(cantidades.products).toBeGreaterThan(0);

    const segunda = await runSeed({ ...base, demo: true });
    expect(segunda.demoCargado).toEqual([]);
    expect({
      categories: await CategoryModel.countDocuments(),
      products: await ProductModel.countDocuments(),
      extras: await ExtraModel.countDocuments(),
      customers: await CustomerModel.countDocuments(),
    }).toEqual(cantidades);

    expect(await CategoryModel.exists({ _id: '66f1a0000000000000000001' })).toBeTruthy();
  });

  it('--demo carga los customers con nombreBusqueda', async () => {
    await runSeed({ ...base, demo: true });
    const customer = await CustomerModel.findOne({ telefono: '5493362222222' }).lean();
    expect(customer?.nombreBusqueda).toBe('cliente con transferencia');
  });
});
