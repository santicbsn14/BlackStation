import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// Un solo mongod para todas las suites (cada archivo usa su propia base). El binario lo baja el
// postinstall al cache de la raíz; sin esto, desde apps/api lo buscaría (y bajaría) en otro lado.
process.env.MONGOMS_DOWNLOAD_DIR ??= fileURLToPath(
  new URL('../../../node_modules/.cache/mongodb-memory-server', import.meta.url),
);

export default async function setup(project: TestProject) {
  const server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri());
  return async () => {
    await server.stop();
  };
}
