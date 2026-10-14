# Brief 05b — Auth (login, requireAdmin, X-Print-Key) y settings

## Objetivo
Autenticación completa de la API y los primeros endpoints reales:
- `POST /api/auth/login`, middleware `requireAdmin` y middleware `requirePrintKey`.
- Límite de intentos de login.
- `GET /api/public-settings`, `GET /api/admin/settings` y `PUT /api/admin/settings`, con sus mappers y validators.

Con esto el panel puede loguearse contra la API real y editar los ajustes.
Guardá este brief en `docs/briefs/etapa-05b-auth-settings.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3.7, §3.8, §6, §7, §8.4, §9, §10), docs/ESTADO.md.

## Alcance

### 1. docs/MODELO_DATOS.md (primero)
- §7 Login:
  - Body: `usuario` y `password` strings no vacíos; si no, 400 `VALIDATION_ERROR`.
  - `expiresAt` = emisión + 12 h, en ISO.
  - Si el usuario no existe, se compara igual contra un hash fijo, para que la demora sea la misma.
- §7 Límite de intentos:
  - 10 logins fallidos por IP en una ventana de 15 minutos, que arranca con el primer fallo.
  - Al llegar al tope, 429 `TOO_MANY_ATTEMPTS` con header `Retry-After` (segundos) hasta que se cumple la ventana, aunque las credenciales sean correctas.
  - Un login exitoso resetea el contador de esa IP.
  - El contador vive en memoria: se reinicia con cada deploy, y es aceptado porque Render Starter tiene una sola instancia.
- §7 `requireAdmin`:
  - Valida solo firma y vencimiento del JWT (HS256), sin consultar la base.
  - `rol` tiene que ser `admin`.
  - Cambiar el password no invalida los tokens emitidos: vencen solos a las 12 h. Para cortar todas las sesiones, se cambia `JWT_SECRET`.
- §9 `X-Print-Key`: comparación en tiempo constante (sha256 de ambos lados + `timingSafeEqual`).
- §8.4 `PUT /api/admin/settings` (reglas iguales a `validarSettings` de `apps/web/src/services/mocks/admin.ts`, con los mismos mensajes):
  - `horarios`: exactamente 7, un `dia` 0–6 cada uno sin repetir, `abre`/`cierra` en `HH:mm`, `abre ≠ cierra`. Se guardan ordenados por `dia`.
  - `intervaloMin`: entero entre 5 y 120.
  - `cupoMaxDefault`: entero ≥ 1.
  - `anticipacionMinMin`: entero ≥ 0.
  - `minutosTransferencia`: entero ≥ 1.
  - `telefonoLocal`: cumple `TELEFONO_REGEX`.
  - `alias`, `cbu`, `titular` y los 3 `mensajes`: strings no vacíos (con trim).
  - `pedidosHabilitados`: boolean.
  - `reputacion`: hasta la Etapa 06 se **ignora en el PUT** y se conserva el valor guardado.
  - Cambiar `cupoMaxDefault` no modifica franjas que ya existen como documento.
  - Cualquier violación: 400 `VALIDATION_ERROR` con el mensaje de la regla.
- §6 / §8.4: si no existe el documento `settings`, 500 `INTERNAL_ERROR`, con un log que diga que falta correr el seed.
- §10: code `TOO_MANY_ATTEMPTS` (429).

### 2. @blackstation/shared
- `TOO_MANY_ATTEMPTS` en `ERROR_CODES` y `ERROR_STATUS` (429), con test.

### 3. apps/api
- `services/auth.ts`:
  - `login(usuario, password)`: busca el usuario activo, compara con bcryptjs y firma el JWT `{ sub, rol }`, `expiresIn: '12h'`.
  - Si el usuario no existe o está inactivo, compara contra un hash fijo y tira `INVALID_CREDENTIALS`.
  - Devuelve `LoginResponse`.
- `lib/loginLimiter.ts`:
  - `Map<ip, { fallos, desde }>` con el reloj de `now()`.
  - Expone `check(ip)`, `registrarFallo(ip)` y `reset(ip)`.
  - Las entradas vencidas se limpian al consultarlas y con un barrido cada 15 min (`unref`).
  - La IP sale de `req.ip`; `trust proxy` ya está en 1.
- `middlewares/requireAdmin.ts`:
  - Lee `Authorization: Bearer`.
  - Si falta, el JWT es inválido o vencido, o el `rol` no es válido: 401 `UNAUTHORIZED`.
  - Deja `{ userId, rol }` en `res.locals.auth`, tipado y sin `any`.
- `middlewares/requirePrintKey.ts`: si falta el header o no coincide, 401 `UNAUTHORIZED`. Las rutas del print server llegan después; acá va solo el middleware con su test.
- `mappers/settings.ts`:
  - `toSettings(doc)`: `Settings` con `_id` string y `updatedAt` ISO.
  - `toPublicSettings(doc)`: `PublicSettings`, recorte explícito.
- `validators/auth.ts`, `validators/settings.ts`: zod. Los tipos inferidos tienen que ser compatibles con `LoginRequest` y `UpdateSettingsRequest`.
- `services/settings.ts`: `getSettings()`, `getPublicSettings()`, `updateSettings(input)`. Devuelven tipos de shared, nunca documentos.
- `controllers/` + `routes/`:
  - `routes/auth.ts` → `/api/auth`.
  - `routes/public.ts` → `/api/public-settings` (acá se van a sumar catalog, slots y orders).
  - `routes/admin/index.ts`: router `/api/admin` con `requireAdmin` aplicado a todo el router, más `routes/admin/settings.ts`.
- `app.ts`: monta los routers antes de `notFound`.

### Fuera de alcance
- Catálogo, franjas, pedidos, clientes, Cloudinary, job de vencimiento y endpoints del print server.
- Cambios en el front: `services/api` ya implementa `login`, `getPublicSettings`, `getAdminSettings` y `updateSettings`.

## Archivos a crear o modificar
- Crear: los de §3 y sus tests en `apps/api/test/` (`auth.test.ts`, `loginLimiter.test.ts`, `printKey.test.ts`, `settings.test.ts`) y `docs/briefs/etapa-05b-auth-settings.md`.
- Modificar: `apps/api/src/app.ts`, `docs/MODELO_DATOS.md`, `packages/shared/src/errors.ts` y su test, `CLAUDE.md` (sumar `requireAdmin`, `requirePrintKey` y `loginLimiter` a la estructura de `apps/api`), `docs/ESTADO.md`.

## Criterios de aceptación
Tests con supertest + mongodb-memory-server. Reloj fijado con `setClock` donde haga falta.
- Login:
  - Credenciales válidas → 200 `{ token, expiresAt, user: { _id, nombre, rol } }`. `expiresAt` es emisión + 12 h y la respuesta no trae `passwordHash`.
  - Password incorrecto, usuario inexistente o usuario inactivo → 401 `INVALID_CREDENTIALS`.
  - Body vacío o sin `password` → 400 `VALIDATION_ERROR`.
- Límite:
  - El intento 11 con fallos seguidos desde la misma IP → 429 `TOO_MANY_ATTEMPTS` con `Retry-After`, aunque las credenciales sean correctas.
  - Pasados 15 min (reloj adelantado) → vuelve a permitir.
  - Un login exitoso resetea el contador.
  - Otra IP no se ve afectada.
- `requireAdmin` (sobre `GET /api/admin/settings`):
  - Sin header, token mal formado, firmado con otro secreto o vencido (reloj +12 h 1 s) → 401 `UNAUTHORIZED`.
  - Token válido → 200.
- `requirePrintKey` (ruta de prueba):
  - Sin header, clave incorrecta o de distinto largo → 401 `UNAUTHORIZED`.
  - Clave correcta → pasa.
- `GET /api/public-settings` sin auth → solo los campos de `PublicSettings`: no trae `mensajes`, `cupoMaxDefault` ni `_id`.
- `GET /api/admin/settings` → `Settings` completo, con `_id` string y `updatedAt` ISO.
- `PUT /api/admin/settings`:
  - Válido → 200 con lo guardado; `updatedAt` cambia y los horarios vuelven ordenados por `dia`.
  - Cada regla de §8.4 rechazada con 400 `VALIDATION_ERROR`: 6 horarios, día repetido, `abre = cierra`, hora `25:00`, intervalo 4 y 121, cupo 0, teléfono inválido, alias vacío.
  - `reputacion` en el body no pisa la guardada.
- Sin documento `settings` → 500 `INTERNAL_ERROR`.
- Manual: con la API corriendo y `apps/web/.env` en `VITE_USE_MOCKS=false` y `VITE_API_URL=http://localhost:3000`, el login del panel funciona con el usuario del seed y `/admin/ajustes` carga y guarda. El resto del panel todavía da error porque faltan endpoints, y es esperado.
- `npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
Actualizar `docs/ESTADO.md`: entrada 05b con lo hecho y los desvíos.
