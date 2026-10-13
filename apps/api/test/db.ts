import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';
import { connectDb, disconnectDb } from '../src/db/connect';

/** Conecta la suite a una base propia en el mongod de `globalSetup` y la borra al final. */
export function useTestDb(): void {
  beforeAll(async () => {
    await connectDb(`${inject('mongoUri')}test-${randomUUID()}`);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
      await mongoose.connection.dropDatabase();
      await disconnectDb();
    }
  });
}

/** Borra todos los documentos de todas las colecciones (los índices quedan). */
export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
}
