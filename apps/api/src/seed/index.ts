import { z } from 'zod';
import { formatEnvIssues } from '../config/env';
import { connectDb, disconnectDb } from '../db/connect';
import { runSeed } from './runSeed';

// El seed solo necesita la base y el admin: valida sus variables y no el env completo de la API.
const seedEnvSchema = z.object({
  MONGODB_URI: z.string().min(1, 'no puede estar vacía'),
  SEED_ADMIN_USUARIO: z.string().min(1, 'no puede estar vacía'),
  SEED_ADMIN_PASSWORD: z.string().min(1, 'no puede estar vacía'),
  SEED_ADMIN_NOMBRE: z.string().min(1, 'no puede estar vacía'),
});

const parsed = seedEnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(`Variables de entorno inválidas:\n${formatEnvIssues(parsed.error, process.env)}`);
  process.exit(1);
}
const env = parsed.data;
const demo = process.argv.includes('--demo');

try {
  await connectDb(env.MONGODB_URI);
  const result = await runSeed({
    demo,
    admin: {
      usuario: env.SEED_ADMIN_USUARIO,
      password: env.SEED_ADMIN_PASSWORD,
      nombre: env.SEED_ADMIN_NOMBRE,
    },
  });
  console.log(`Índices sincronizados.`);
  console.log(result.settingsCreado ? 'settings creado.' : 'settings ya existía (sin cambios).');
  console.log(`Usuario "${env.SEED_ADMIN_USUARIO}" actualizado.`);
  if (demo) {
    console.log(
      result.demoCargado.length > 0
        ? `Demo cargado: ${result.demoCargado.join(', ')}.`
        : 'Demo: las colecciones ya tenían datos (sin cambios).',
    );
  }
} catch (err) {
  console.error('El seed falló:', err);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
