# Black Station — Estado del proyecto

## Etapas

| Etapa | Descripción | Estado |
|---|---|---|
| 00 | Definición del proyecto: alcance, stack y documentación base | ✅ Cerrada |
| 01 | Modelo de datos, estados, reglas de negocio y endpoints | ✅ Cerrada |
| 02 | Setup del monorepo: `shared`, design system base, routing, servicios y mocks | ✅ Cerrada |
| 02b | Ajustes post-revisión: códigos de error, `abierto` en slots, listas admin envueltas | ✅ Cerrada |
| 03 | App pública: catálogo, carrito, checkout y seguimiento del pedido | Pendiente |
| 04 | Panel: login, comanda, catálogo, franjas, clientes y ajustes (+ services/mocks admin) | Pendiente |
| 05 | API (`apps/api`): Express por capas, MongoDB, auth y job de vencimiento | Pendiente |
| 06 | Reglas de reputación de clientes | Pendiente |
| 07 | Print server (`apps/print-server`): ESC/POS + PM2 | Pendiente |
| 08 | Pulido y salida a producción (marca definitiva, settings reales) | Pendiente |

## Documentos

- [MODELO_DATOS.md](MODELO_DATOS.md) — fuente de verdad del modelo de datos, estados,
  reglas de negocio y endpoints.
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — arquitectura CSS, tokens y reglas de estilos.

## Registro de cambios

### 2026-09-28 — Etapa 02b cerrada
- `@blackstation/shared`: `errors.ts` con `ERROR_CODES` + `ErrorCode` (tabla de §10),
  `ERROR_STATUS` (code → HTTP) e `isErrorCode`. `ApiErrorBody.code` es `ErrorCode`.
  `SlotsResponse` suma `abierto`. `AdminCategoriesResponse`/`AdminProductsResponse`/
  `AdminExtrasResponse` pasan a `{ categories }`/`{ products }`/`{ extras }`. 43 tests (+3).
- Mocks: la jornada calcula `abierta` (`abre` ≤ ahora < `cierra`, con cruce de medianoche).
  `GET /slots` devuelve `abierto` y `slots: []` si es `false`; `POST /orders` tira 423 `CLOSED`
  fuera de horario. `VITE_MOCK_FORCE_OPEN=true` sigue abriendo siempre.
- `mockError(code, message)` toma un `ErrorCode` y saca el status de `ERROR_STATUS`: ya no hay
  status ni codes sueltos sin tipar en los mocks.

**Desvíos**
- `ERROR_STATUS` e `isErrorCode` no estaban en el brief: el primero evita que un mock devuelva un
  status distinto al de §10; el segundo lo usa `http.ts`.
- `http.ts` (fuera de `mocks/**`): el type guard de `ApiErrorBody` valida `code` con
  `isErrorCode`. Un `code` desconocido de la API cae en `HTTP_ERROR`. `ApiError.code` sigue siendo
  `string` porque el front suma `HTTP_ERROR` y `NETWORK_ERROR`, que no están en §10.
- En los mocks los codes se escriben como literales tipados `ErrorCode` (`mockError('SLOT_FULL', …)`),
  no como `ERROR_CODES[n]`: §10 define `ERROR_CODES` como array, así que no hay constantes por
  nombre; el compilador rechaza cualquier code fuera de la tabla.
- El checkout de prueba no muestra `abierto` todavía (pantallas quedan para la Etapa 03).

### 2026-09-25 — Etapa 02 cerrada
- Monorepo con npm workspaces (`apps/web`, `packages/shared`), Node 24, TS strict, ESLint flat
  (TS + React hooks + límites entre `features/public` y `features/admin`), Prettier y Vitest.
- `@blackstation/shared`: enums, tabla de transiciones + `puedeTransicionar`, constantes, tipos
  de §6–9 (entidades y recortes públicos), `normalizarTelefono`, `formatearPrecio`,
  `calcularSubtotal`/`calcularTotal`. 40 tests.
- `apps/web`: design system base (tokens, reset, base, layout, utilities, Archivo con eje
  `wdth`), router con todas las rutas (`/admin` lazy en chunks propios, con su CSS),
  `RequireAuth`, login funcional, `http.ts` + `ApiError`, query keys, services api + mocks para
  catálogo, slots, public-settings, orders y login. `/checkout` tiene un botón de prueba para
  crear pedidos (y llenar una franja hasta el 409).
- Mocks: store en `bs-mock-db` con versión (subirla fuerza reseed), fixtures de 4 categorías,
  13 productos (uno agotado, uno inactivo), 5 extras y settings de §3.7. Franjas y jornada en
  `America/Argentina/Buenos_Aires` con cruce de medianoche.

**Desvíos y decisiones a revisar**
- **TypeScript 6.0**, no 7: `typescript-eslint` todavía no soporta TS 7.
- Dependencias de tooling no nombradas en el brief: `eslint`, `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react-hooks`, `globals`, `prettier`, `vitest`, `vite`, `@vitejs/plugin-react`,
  `@types/react`, `@types/react-dom`. Agregado `.prettierignore` para que `npm run format` no
  toque `docs/` ni `CLAUDE.md`.
- `normalizarTelefono` quita el `15` solo si sobran exactamente esos 2 dígitos, para no romper
  números que empiezan con 15 sin ser el prefijo de celular (ej. `11` + `15234567`).
- ✅ *Resuelto en 02b (§3.4).* Formato de `codigo` (§11 pendiente): implementado en el mock como 8 caracteres del alfabeto
  `A–Z` + `2–9` sin `0/O/1/I/L`. Falta cerrarlo en `MODELO_DATOS.md`.
- ✅ *Resuelto en 02b (§10 + `ERROR_CODES`).* Códigos de error del mock (§10 dice que se definen al implementar): `ORDERS_DISABLED`,
  `CLOSED` (423); `EMPTY_ORDER`, `PRODUCT_UNAVAILABLE`, `INVALID_QUANTITY`, `INVALID_REMOVED`,
  `EXTRA_UNAVAILABLE`, `INVALID_EXTRA_QUANTITY`, `INVALID_ACLARACION`, `INVALID_NOMBRE`,
  `INVALID_TELEFONO`, `INVALID_METODO_PAGO`, `INVALID_SLOT`, `SLOT_TOO_SOON` (400);
  `SLOT_FULL`, `SLOT_CLOSED` (409); `ORDER_NOT_FOUND` (404); `INVALID_CREDENTIALS`,
  `UNAUTHORIZED` (401). Conviene pasarlos a `MODELO_DATOS.md` antes de la Etapa 05.
- El mock de `POST /orders` no valida reputación del customer (§5.3 punto 2, 403) ni hace el
  upsert de `customers`: fuera del alcance del brief, queda para la Etapa 04/06.
- ✅ *Resuelto en 02b (§5.1, §5.3): fuera de `abre`–`cierra` → 423 `CLOSED`.* Pedir a las 10:00 para una franja de esa noche se acepta (misma jornada). El 423 solo sale con
  `pedidosHabilitados = false` o día inactivo. Confirmar si "fuera de horario" debe incluir esto.
- ✅ *Resuelto en 02b (§8.2).* §8.2 dice "Lista completa" para `GET /api/admin/{categories,products,extras}`: se tipó como
  array plano (`Category[]`), a diferencia de `{ orders }`/`{ customers }`. Confirmar en §8.2.
- Con `VITE_MOCK_FORCE_OPEN=true` la anticipación mínima sigue aplicando (solo se ignoran los
  horarios), así que las primeras ~2 franjas no se ofrecen.
- ✅ *Resuelto en 02b (`DESIGN_SYSTEM.md` §8).* `tokens.css` y `fonts.css` no declaran `@layer` (solo custom properties / `@font-face`),
  como indica el diagrama de `DESIGN_SYSTEM.md`.
- `ApiError` (clase, no service) se importa desde `services` en `main.tsx` y en el checkout de
  prueba para mostrar `status`/`code`.
- En Vercel hay que configurar las variables `VITE_*` en el dashboard (el `.env` local está en
  `.gitignore`; `apps/web/.env.example` tiene los valores para mocks).

### 2026-09-25 — Etapa 01 cerrada
- Creado `docs/MODELO_DATOS.md`: convenciones de formato, 8 colecciones con campos e índices,
  diagrama de estados del pedido, reglas de negocio y endpoints por nivel de acceso.
- Agregado `extras.activo` para soportar el borrado soft del CRUD de extras.
- Quedan pendientes: reglas de reputación (Etapa 06) y valores por defecto de `settings`.
