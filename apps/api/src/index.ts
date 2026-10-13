import { createApp } from './app';
import { EnvError, getEnv, type Env } from './config/env';
import { connectDb, disconnectDb } from './db/connect';

function loadEnv(): Env {
  try {
    return getEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

const env = loadEnv();

try {
  await connectDb(env.MONGODB_URI);
} catch (err) {
  console.error('No se pudo conectar a MongoDB:', err);
  process.exit(1);
}

const server = createApp().listen(env.PORT, (err) => {
  if (err) {
    console.error('No se pudo levantar el server:', err);
    process.exit(1);
  }
  console.log(`API escuchando en el puerto ${env.PORT} (${env.NODE_ENV}).`);
  if (env.FORCE_OPEN) console.warn('FORCE_OPEN activo: se ignoran los horarios.');
});

// Render manda SIGTERM en cada deploy: cerrar el server y la conexión antes de salir.
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} recibido, cerrando…`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    disconnectDb()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        console.error(err);
        process.exit(1);
      });
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
