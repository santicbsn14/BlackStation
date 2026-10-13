# Brief 05a — Base de la API: esqueleto, env, errores, modelos, seed y /health

## Objetivo
Crear `apps/api` con la base sobre la que se montan los endpoints:
- estructura por capas, validación del env y manejo de errores con el formato de §10;
- conexión a Mongo, todos los modelos con sus índices, contador de `numero` y seed;
- `GET /health`.

Sin endpoints de negocio: van en 05b en adelante.
Guardá este brief en `docs/briefs/etapa-05a-base-api.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md, docs/ESTADO.md.

## Alcance

### 1. docs/MODELO_DATOS.md (primero, antes de tocar código)
- §3: colección nueva `counters`.
  - Campos: `{ _id: string, seq: number }`. El `_id` es `orders:<fecha>` (ej. `orders:2026-10-10`).
  - `numero` se asigna con `findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { upsert: true, new: true })`.
  - Se toma al final de la creación del pedido, con el cupo ya reservado.
  - Si el insert del pedido falla después, ese número queda salteado (aceptado).
  - El índice único `(fecha, numero)` de `orders` queda como red de seguridad.
- §3.6 `customers`: campo interno `nombreBusqueda`.
  - Valor: `nombre` en minúsculas, sin tildes (NFD + quitar diacríticos).
  - Se setea en toda escritura que toque `nombre`, explícito en el service: no con hook de `save`, porque los `findOneAndUpdate` no lo disparan.
  - No se expone en la API.
  - §8.5: la búsqueda por nombre usa este campo con `q` normalizado igual y escapado para la regex.
- §6 `GET /health`: `{ ok: true, time }`. Si Mongo no está conectado, 503 con `{ ok: false, time }`, así UptimeRobot avisa también si se cae la base.
- §10: code `INTERNAL_ERROR` (500), para cualquier error no previsto. El mensaje es genérico y nunca expone el detalle.
- §11: el pendiente de `numero` pasa a resuelto (ver `counters`).

### 2. @blackstation/shared
- `INTERNAL_ERROR` en `ERROR_CODES` y `ERROR_STATUS` (500). Actualizar los tests.

### 3. apps/api — esqueleto
- Express 5, ESM, TS strict con la config base.
- Estructura:
  `src/{index.ts, app.ts, config/env.ts, db/connect.ts, models/, routes/, controllers/, services/, validators/, mappers/, middlewares/, jobs/, lib/, seed/}`.
  Las carpetas que todavía no se usan quedan con un `.gitkeep`.
- `app.ts`:
  - Exporta `createApp()`, sin `listen` (para los tests).
  - `express.json({ limit: '100kb' })`.
  - `cors` con la lista `CORS_ORIGINS`.
  - `trust proxy` en 1 y `x-powered-by` apagado.
  - Rutas, `notFound` y `errorHandler`.
- `index.ts`:
  - Valida el env, conecta Mongo y levanta el server.
  - Con SIGTERM/SIGINT cierra el server y la conexión (Render manda SIGTERM en cada deploy).
- `config/env.ts`: valida `process.env` con zod y exporta un objeto tipado. Si falta algo, el proceso no arranca y dice qué falta. Variables:
  - `NODE_ENV`: `development` | `test` | `production`.
  - `PORT`: default 3000.
  - `MONGODB_URI`.
  - `JWT_SECRET`: mínimo 32 caracteres.
  - `PRINT_KEY`: mínimo 32 caracteres.
  - `CORS_ORIGINS`: lista separada por comas.
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
  - `FORCE_OPEN`: default `false`. Con `NODE_ENV=production` es un error de validación.
- `lib/AppError.ts`: `new AppError(code: ErrorCode, message)`. El status sale de `ERROR_STATUS`.
- `lib/clock.ts`: `now()` reemplazable en los tests. Nada del código de la API usa `new Date()` para "ahora" de forma directa.
- `lib/texto.ts`: `normalizarBusqueda(s)` y `escaparRegex(s)`.
- `middlewares/errorHandler.ts` responde siempre `{ error: { code, message } }`:
  - `AppError` → su code y status.
  - `ZodError` → 400 `VALIDATION_ERROR`.
  - JSON mal formado → 400 `VALIDATION_ERROR`.
  - `CastError` de Mongoose → 400 `VALIDATION_ERROR`.
  - Cualquier otro → 500 `INTERNAL_ERROR`, con log del stack en consola.
- `middlewares/notFound.ts`: 404 `NOT_FOUND`.
- `middlewares/validate.ts`: helper que valida body/query/params con un schema zod y deja el resultado tipado.
- `routes/health.ts`: `GET /health` según §6 (usa `mongoose.connection.readyState`).

### 4. Modelos (`models/`)
- Un archivo por colección: `Category`, `Product`, `Extra`, `Order`, `PickupSlot`, `Customer`, `Settings`, `User`, `Counter`.
- Campos, defaults, enums e índices exactos de §3:
  - Los enums salen de los arrays de shared.
  - `timestamps: true` donde §3 tiene `createdAt`/`updatedAt`.
  - `settings.reputacion`: opcional y sin forma hasta la Etapa 06.
- Tipos del documento con `InferSchemaType`. No se mezclan con los tipos de la API de shared (los mappers llegan en 05b).
- `autoIndex` activo. El seed además llama a `syncIndexes()` de cada modelo.
- `services/counters.ts`: `nextNumero(fecha): Promise<number>`.

### 5. Seed (`seed/index.ts`)
- Comando: `npm run seed -w @blackstation/api`, más `-- --demo` para el catálogo de prueba.
- Idempotente:
  - `settings`: lo crea solo si no existe, con los defaults de §3.7. Nunca pisa uno existente.
  - Usuario admin: upsert por `usuario` con `SEED_ADMIN_USUARIO`, `SEED_ADMIN_PASSWORD` (bcryptjs, costo 10) y `SEED_ADMIN_NOMBRE`. Estas tres variables las valida solo el seed.
  - `--demo`: carga categories, products, extras y customers solo si esas colecciones están vacías.
    - Fuente: copias de `apps/web/src/services/mocks/data/*.json` en `apps/api/src/seed/data/`, manteniendo los `_id`.
    - Los customers se cargan con su `nombreBusqueda`.

### 6. Scripts y config
- `apps/api/package.json` (`@blackstation/api`):
  - `dev`: `tsx watch --env-file-if-exists=.env src/index.ts`.
  - `build`: tsup.
  - `start`: `node dist/index.js`.
  - `seed`: corre el seed con tsx y `.env`.
  - `typecheck`, `test`.
- `tsup.config.ts`:
  - Entradas `src/index.ts` y `src/seed/index.ts`.
  - ESM, target node24.
  - `noExternal: ['@blackstation/shared']`.
  - Copia `seed/data` a `dist`.
- Raíz: suma `dev:api` y `build:api`. `build` sigue siendo solo web (no tocar el deploy de Vercel).
- `.env.example` en `apps/api` con todas las variables y valores de ejemplo, sin secretos reales.
- ESLint: `apps/api` con globals de Node.

### 7. Dependencias (solo estas)
- `apps/api`, runtime: `express`, `mongoose`, `zod`, `jsonwebtoken`, `bcryptjs`, `cors`.
- `apps/api`, dev: `tsx`, `tsup`, `vitest`, `supertest`, `mongodb-memory-server`, `@types/express`, `@types/jsonwebtoken`, `@types/cors`, `@types/supertest`, `@types/node`.
- Si alguna ya trae sus tipos, no sumar el `@types`.

### 8. Front: `VITE_FORCE_OPEN`
- `VITE_MOCK_FORCE_OPEN` pasa a llamarse `VITE_FORCE_OPEN`.
- Los mocks la leen igual que antes.
- En `services/index.ts`: `jornadaForzada = VITE_FORCE_OPEN === 'true'` en los dos modos (con la API real indica que la API corre con `FORCE_OPEN`).
- Actualizar `.env.example` de web y `CLAUDE.md`.

### 9. CLAUDE.md
- `apps/api` deja de figurar como "todavía no existe".
- Sección `apps/api`: estructura, flujo route → controller (valida) → service (reglas, devuelve tipos de shared vía mappers) → model.
- Regla: los services nunca devuelven documentos de Mongo.
- Variables de entorno de la API y comandos `dev:api`, `build:api` y `seed`.

### Fuera de alcance
- Endpoints de negocio, auth, mappers, job de vencimiento, CORS de producción y deploy.
- Cambios en las pantallas del front.

## Archivos a crear o modificar
- Crear: todo `apps/api/` (incluidos `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.env.example` y los tests).
- Modificar:
  - `docs/MODELO_DATOS.md`, `CLAUDE.md`, `docs/ESTADO.md`.
  - `packages/shared/src/errors.ts` y su test.
  - `package.json` raíz y config de ESLint.
  - `apps/web/src/services/index.ts`, los mocks que leen `VITE_MOCK_FORCE_OPEN` y `apps/web/.env.example`.
  - Crear `docs/briefs/etapa-05a-base-api.md`.

## Criterios de aceptación
Tests con Vitest + supertest + mongodb-memory-server.
- Env:
  - Falta `MONGODB_URI` → el proceso no arranca y lo dice.
  - `FORCE_OPEN=true` con `NODE_ENV=production` → no arranca.
- Errores (con rutas de prueba registradas solo en el test):
  - `AppError('SLOT_FULL')` → 409 con el formato de §10.
  - Error de zod → 400 `VALIDATION_ERROR`.
  - JSON mal formado → 400 `VALIDATION_ERROR`.
  - Ruta inexistente → 404 `NOT_FOUND`.
  - Un `throw new Error('secreto')` → 500 `INTERNAL_ERROR`, y la respuesta no contiene "secreto".
- `/health`:
  - 200 `{ ok: true, time }` con la base conectada.
  - 503 con la conexión cerrada.
- Índices: un duplicado de `orders.codigo`, `(fecha, numero)`, `pickupSlots (fecha, hora)`, `customers.telefono` y `users.usuario` es rechazado.
- `nextNumero`:
  - Secuencial por fecha.
  - Arranca en 1 para una fecha nueva.
  - 20 llamadas en paralelo dan 1..20 sin repetidos.
- `normalizarBusqueda('Juán PÉREZ')` → `'juan perez'`.
- `escaparRegex` neutraliza `.*+?()[]`.
- Seed:
  - Dos corridas → 1 `settings` y 1 usuario.
  - Un `settings` editado no se pisa.
  - `--demo` no duplica el catálogo.
  - El password se guarda hasheado.
- `npm run dev:api` levanta contra Atlas `blackstation-dev` y `GET /health` responde 200.
- La app web con mocks y `VITE_FORCE_OPEN=true` se comporta igual que antes.
- `npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
Actualizar `docs/ESTADO.md`: entrada 05a con lo hecho y los desvíos. En la tabla de etapas, 05 queda "En curso".
