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
│   ├── api/                ← Express por capas (Etapa 05, todavía no existe)
│   └── print-server/       ← ESC/POS + PM2 (Etapa 07, todavía no existe)
└── packages/
    └── shared/             ← @blackstation/shared: tipos de la API, enums, utils puras
```

- `apps/*` nunca se importan entre sí. Lo común va a `packages/shared`.
- `shared` se consume como **TS fuente** (sin build). La api lo bundlea con `tsup` en Etapa 05.

### Comandos (desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta `apps/web`. |
| `npm run build` | Build de `apps/web`. |
| `npm run typecheck` | `tsc --noEmit` en todos los workspaces. |
| `npm run lint` | ESLint en todo el repo. |
| `npm run test` | Vitest (hoy: `packages/shared`). |
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
├── hooks/                  ← genéricos (usePolling, useCountdown)
└── lib/                    ← helpers solo de front (links wa.me, plantillas de mensajes)
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
  consultar por `codigo` después de recargar.
- Latencia simulada (300–600 ms).
- Errores con el mismo formato y status que la API (400, 401, 403, 404, 409, 423).
- Los fixtures de `settings` usan los defaults de `MODELO_DATOS.md` §3.7.

### Estado de cliente

- Carrito: Context + `useReducer`, persistido en `localStorage` (`bs-cart`). Guarda solo
  `productoId`, `cantidad`, `quitados`, `extras[{ extraId, cantidad }]`. Precio y disponibilidad
  se recalculan siempre contra el catálogo.
- Token admin: `localStorage` (`bs-token`) + `expiresAt`.

### Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_API_URL` | Base URL de la API. |
| `VITE_USE_MOCKS` | `true` = usa `services/mocks`. |
| `VITE_MOCK_FORCE_OPEN` | Solo mocks: ignora `horarios` y genera franjas desde ahora (para desarrollar de día). |

## packages/shared

```
packages/shared/src/
├── index.ts
├── enums.ts          ← estados, motivos, métodos de pago, estados de customer, roles
├── transitions.ts    ← tabla de transiciones + puedeTransicionar()
├── constants.ts      ← ZONA_HORARIA, ACLARACION_MAX, etc.
├── types/            ← common, catalog, orders, slots, customers, settings, auth
└── utils/            ← telefono, precio, pedido (+ tests *.test.ts)
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
