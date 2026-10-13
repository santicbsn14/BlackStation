# Black Station — CLAUDE.md

Sistema de pedidos para retiro de un carrito de comidas: catálogo público + checkout sin registro,
panel de comanda en vivo, API y print server local para tickets térmicos.

## Docs (leer antes de tocar código)

| Doc | Para qué |
|---|---|
| `docs/MODELO_DATOS.md` | **Fuente de verdad** de datos, estados, reglas de negocio y endpoints. |
| `docs/DESIGN_SYSTEM.md` | Arquitectura CSS, tokens, nombres y reglas de estilos. |
| `docs/ESTADO.md` | Estado actual y registro de cambios. Se actualiza al terminar cada tarea. |
| `docs/briefs/` | Briefs de cada etapa. |

## Cómo trabajar

- Si el brief contradice `MODELO_DATOS.md` o este archivo: **frenar y avisar**, no improvisar.
- No salir del alcance del brief. No agregar dependencias que el brief no nombre.
- Todo cambio de schema, validación o contrato de API se refleja primero en `MODELO_DATOS.md`.
- Al terminar: entrada corta en `docs/ESTADO.md` (fecha, qué se hizo, desvíos). Sin código.

## Monorepo

npm workspaces. Todo en TypeScript.

```
black-station/
├── CLAUDE.md
├── package.json            ← workspaces ["apps/*", "packages/*"], engines.node 24.x
├── tsconfig.base.json
├── .nvmrc                  ← 24
├── docs/
├── apps/
│   ├── web/                ← React + Vite: app pública + panel (/admin)
│   ├── api/                ← Express 5 por capas + Mongoose (Etapa 05)
│   └── print-server/       ← ESC/POS + PM2 (Etapa 07, todavía no existe)
└── packages/
    └── shared/             ← @blackstation/shared: tipos de la API, enums, utils puras
```

- `apps/*` nunca se importan entre sí. Lo común va a `packages/shared`.
- `shared` se consume como **TS fuente** (sin build). La api lo bundlea con `tsup` (`noExternal`).

### Comandos (desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta `apps/web`. |
| `npm run dev:api` | Levanta `apps/api` con `tsx watch` y `apps/api/.env`. |
| `npm run build` | Build de `apps/web` (es el que usa Vercel; no suma la api). |
| `npm run build:api` | Build de `apps/api` con tsup a `apps/api/dist`. |
| `npm run seed -w @blackstation/api` | Settings + usuario admin (idempotente). `-- --demo` suma el catálogo de prueba. |
| `npm run typecheck` | `tsc --noEmit` en todos los workspaces. |
| `npm run lint` | ESLint en todo el repo. |
| `npm run test` | Vitest (`packages/shared` y `apps/api`, este con mongodb-memory-server). |
| `npm run format` | Prettier. |

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`.
- Prohibido `any`. Usar `unknown` y validar.
- Nada de `enum` de TS: arrays `as const` + tipo derivado, definidos en `shared`.
  ```ts
  export const ESTADOS_PEDIDO = ['pendiente', 'confirmado', 'entregado', 'cancelado'] as const;
  export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
  ```
- `type` para contratos de API. `import type` para imports solo de tipos.

## Nombres

- Entidades en inglés como las colecciones: `Order`, `Product`, `Category`, `Extra`, `PickupSlot`, `Customer`, `Settings`.
- Campos en español, **idénticos al JSON** de `MODELO_DATOS.md` (`horaRetiro`, `metodoPago`, `ingredientesQuitables`).
- Funciones en inglés, verbo + entidad: `getCatalog`, `createOrder`, `updateOrderEstado`.
- Textos de UI en español rioplatense (voseo).
- Archivos: componentes `PascalCase.tsx`, el resto `camelCase.ts`. Un componente = su CSS al lado
  con el mismo nombre en minúscula (`Button.tsx` + `button.css`).

## apps/web

### Estructura

```
apps/web/src/
├── main.tsx
├── app/
│   ├── router.tsx
│   ├── layouts/            ← PublicLayout, AdminLayout
│   └── RequireAuth.tsx
├── assets/brand/           ← logo.svg, isotipo.svg
├── styles/                 ← design system (ver DESIGN_SYSTEM.md)
├── components/             ← UI base compartida
├── features/
│   ├── public/             ← catalogo, carrito, checkout, pedido
│   └── admin/              ← login, comanda, catalogo, franjas, clientes, ajustes
├── services/
│   ├── http.ts             ← cliente único: base URL, JWT, parseo de errores → ApiError
│   ├── queryKeys.ts        ← factories de query keys por dominio
│   ├── index.ts            ← exporta api o mocks según VITE_USE_MOCKS
│   ├── api/                ← implementación real
│   └── mocks/              ← implementación mock + data/*.json + store
├── hooks/                  ← genéricos (useAhora, useCountdown, useBeep, useDocumentTitle, useDebouncedValue)
└── lib/                    ← helpers solo de front (wa.me, plantillas, hora, teléfono, storage, sesión)
```

- Cada feature tiene `pages/`, `components/`, `hooks/` y su CSS (`pub-*` / `adm-*`).
- `features/public` y `features/admin` **nunca se importan entre sí**.

### Rutas

| Ruta | Pantalla | Carga |
|---|---|---|
| `/` | Catálogo (carrito como drawer) | eager |
| `/checkout` | Datos, franja, método de pago | eager |
| `/pedido/:codigo` | Seguimiento del pedido | eager |
| `/admin/login` | Login | lazy |
| `/admin` | Comanda | lazy + `RequireAuth` |
| `/admin/catalogo` | Productos, categorías, extras (tabs) | lazy + `RequireAuth` |
| `/admin/franjas` | Cupos y cierre de franjas | lazy + `RequireAuth` |
| `/admin/clientes` | Reputación | lazy + `RequireAuth` |
| `/admin/ajustes` | Settings | lazy + `RequireAuth` |
| `*` | 404 | eager |

React Router con `createBrowserRouter`. Todo `/admin` con `lazy` para que la app pública no
descargue el panel (ni su CSS).

### Capa de datos

Flujo obligatorio: **componente → hook de la feature → TanStack Query → service**.

- Un componente **nunca** llama `fetch` ni un service directo, ni `useQuery` con un service suelto:
  usa un hook de su feature (`useCatalog`, `useComanda`, `useCreateOrder`).
- Services: funciones async tipadas con los tipos de `@blackstation/shared`. Misma firma en
  `api/` y `mocks/`.
- `http.ts`: agrega `Authorization: Bearer <token>` en rutas admin; si la respuesta es error,
  parsea `{ error: { code, message } }` y tira `ApiError { status, code, message }`.
- 401 en rutas admin → borrar token y redirigir a `/admin/login`.
- Query keys: una factory por dominio en `services/queryKeys.ts` (`orderKeys.list(fecha)`,
  `catalogKeys.public()`). Nunca keys escritas a mano en los hooks.
- Polling: `refetchInterval`. El polling incremental de la comanda (`?since=`) mergea con
  `queryClient.setQueryData`.
- Después de cada mutación: invalidar las keys afectadas.

### Mocks

- Devuelven **exactamente el JSON de la API** (`MODELO_DATOS.md` §6–9): `_id` string, fechas ISO,
  precios enteros, mismos nombres de campos.
- Store en memoria persistido en `localStorage` (`bs-mock-db`), así un pedido creado se puede
  consultar por `codigo` después de recargar. Se sincroniza entre pestañas con el evento `storage`
  (un pedido de la app pública aparece en la comanda abierta en otra pestaña).
- Rutas admin sin token o con token vencido → 401 `UNAUTHORIZED`, con el mismo manejo que `http.ts`.
- Latencia simulada (300–600 ms). Con `navigator.onLine` en `false` fallan con `NETWORK_ERROR`, como `http.ts`.
- Errores con el mismo formato y status que la API (400, 401, 403, 404, 409, 423).
- Los fixtures de `settings` usan los defaults de `MODELO_DATOS.md` §3.7.

### Estado de cliente

- Carrito: Context + `useReducer`, persistido en `localStorage` (`bs-cart`). Guarda solo
  `productoId`, `cantidad`, `quitados`, `extras[{ extraId, cantidad }]`. Precio y disponibilidad
  se recalculan siempre contra el catálogo.
- Token admin: `localStorage` (`bs-token`) + `expiresAt`. Al vencer, el panel cierra la sesión y vuelve al
  login con `?next=`.
- Cliente del checkout: `localStorage` (`bs-cliente`) con `{ nombre, caracteristica, numero }`, para
  precargar el formulario.
- Pedido en curso: `localStorage` (`bs-pedido-activo`) con `{ codigo }`. Se borra cuando el pedido llega a
  un estado final (o ya no existe).
- Sonido de la comanda: `localStorage` (`bs-sonido`), preferencia on/off del aviso de pedido nuevo.

### Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_API_URL` | Base URL de la API. |
| `VITE_USE_MOCKS` | `true` = usa `services/mocks`. |
| `VITE_FORCE_OPEN` | Mocks: ignora `horarios` y genera franjas desde ahora (para desarrollar de día). Con la API real indica que la API corre con `FORCE_OPEN`. En ambos modos marca `jornadaForzada`. |
| `VITE_MOCK_SIMULAR` | Solo mocks: con el panel abierto, simula un pedido cada 30–60 s (demo). |

## apps/api

```
apps/api/src/
├── index.ts          ← valida env, conecta Mongo, listen; SIGTERM/SIGINT cierran server y conexión
├── app.ts            ← createApp() sin listen (lo usan los tests con supertest)
├── config/env.ts     ← zod sobre process.env; si falta algo no arranca y dice qué
├── db/connect.ts
├── models/           ← un archivo por colección, tipos con InferSchemaType
├── routes/           ← solo montan path + middlewares + controller
├── controllers/      ← validan (validate + zod) y llaman al service
├── services/         ← reglas de negocio
├── validators/       ← schemas zod de body/query/params
├── mappers/          ← documento de Mongo → tipo de shared
├── middlewares/      ← errorHandler, notFound, validate
├── jobs/
├── lib/              ← AppError, clock (now()), texto (normalizarBusqueda, escaparRegex)
└── seed/             ← index.ts (CLI) + runSeed.ts + data/*.json (copias de los mocks)
```

- Flujo: **route → controller (valida) → service (reglas) → model**. El service devuelve tipos de
  `@blackstation/shared` vía mappers.
- Los services **nunca** devuelven documentos de Mongo.
- Errores: `throw new AppError(code, message)`; el status sale de `ERROR_STATUS`. El `errorHandler`
  responde siempre `{ error: { code, message } }` (§10); lo no previsto es 500 `INTERNAL_ERROR` sin detalle.
- "Ahora" siempre con `now()` de `lib/clock.ts`, nunca `new Date()` directo.
- `customers.nombreBusqueda` se setea explícito en el service en toda escritura que toque `nombre`.

### Variables de entorno

| Variable | Uso |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production`. |
| `PORT` | Default 3000. |
| `MONGODB_URI` | Atlas (`blackstation-dev` en desarrollo). |
| `JWT_SECRET` | Mínimo 32 caracteres. |
| `PRINT_KEY` | Clave del print server. Mínimo 32 caracteres. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Imágenes. |
| `FORCE_OPEN` | Default `false`. Ignora horarios; con `NODE_ENV=production` no arranca. |
| `SEED_ADMIN_USUARIO`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NOMBRE` | Solo el seed (las valida él). |

## packages/shared

```
packages/shared/src/
├── index.ts
├── enums.ts          ← estados, motivos, métodos de pago, estados de customer, roles
├── transitions.ts    ← tabla de transiciones + puedeTransicionar()
├── constants.ts      ← ZONA_HORARIA, ACLARACION_MAX, etc.
├── types/            ← common, catalog, orders, slots, customers, settings, auth
└── utils/            ← telefono, precio, pedido, jornada, ticket (+ tests *.test.ts)
```

- Los tipos son el **JSON de la API**, no el documento de Mongo.
- Los tipos públicos son recortes explícitos (`PublicOrder` sin `telefono`), no el tipo admin con
  campos opcionales.
- `utils/`: funciones puras, sin dependencias, con tests en Vitest.
- No va lógica que dependa de DB ni de fecha/hora del servidor.

## CSS

CSS plano con `@layer`, custom properties y nesting nativo. Sin Modules, sin preprocesadores,
sin librerías de UI. Detalle completo en `docs/DESIGN_SYSTEM.md`. Reglas que no se negocian:

- Ningún color, espaciado, radio ni z-index fuera de `tokens.css` (excepción: bordes de `1px`).
- Todo archivo CSS declara su `@layer`.
- Prefijos: `l-` layout, `u-` utilidades, `pub-` pantallas públicas, `adm-` panel, `is-` estados.
- Estados de dominio con `data-*` y el valor del enum: `.badge[data-estado="pendiente"]`.

## Git

Commits cortos en español con prefijo: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

## Antes de dar una tarea por terminada

- `npm run typecheck`, `npm run lint` y `npm run test` pasan.
- `npm run build` pasa.
- `docs/ESTADO.md` actualizado.
