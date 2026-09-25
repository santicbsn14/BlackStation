# Brief — Etapa 02: Setup del monorepo

## Objetivo

Dejar armado el monorepo con `apps/web` y `packages/shared` funcionando: tipos del dominio,
utils con tests, design system base, routing completo con páginas placeholder, capa de servicios
con mocks para lo público y el login, y la app lista para deployar en Vercel con mocks.

## Docs a leer

1. `CLAUDE.md` (raíz): convenciones, estructura, capa de datos, mocks.
2. `docs/MODELO_DATOS.md`: tipos, enums, transiciones, contratos de endpoints y defaults de settings (§3.7).
3. `docs/DESIGN_SYSTEM.md`: arquitectura CSS y tokens.
4. `docs/ESTADO.md`.

## Alcance

### Sí

**Raíz**
- `package.json` con workspaces, `engines.node: "24.x"` y los scripts de `CLAUDE.md` (dev, build,
  typecheck, lint, test, format).
- `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `moduleResolution: "Bundler"`), `.nvmrc`, `.editorconfig`, `.prettierrc`, ESLint flat config
  único (TS + React hooks), `.gitignore`.

**packages/shared** (`@blackstation/shared`, consumido como TS fuente)
- `enums.ts`: estados de pedido, motivos de cancelación, métodos de pago, estados de customer, roles.
- `transitions.ts`: tabla de transiciones de `MODELO_DATOS` §4 y
  `puedeTransicionar(desde, hacia, motivo, actor: 'panel' | 'job')`. `vencido` solo con `job`.
- `constants.ts`: `ZONA_HORARIA`, `ACLARACION_MAX`.
- `types/`: todos los tipos de request/response de §6, §7, §8 y §9, más las entidades como las
  devuelve la API. Tipos públicos como recortes explícitos. `ApiErrorBody` con `code: string`.
- `utils/telefono.ts`: `normalizarTelefono(caracteristica, numero)`. Quita no-dígitos, un `0`
  inicial de la característica y un `15` inicial del número; exige 10 dígitos entre los dos;
  devuelve `549…` o un resultado de error tipado (no tira excepción).
- `utils/precio.ts`: `formatearPrecio` (formato de `MODELO_DATOS` §1).
- `utils/pedido.ts`: `calcularSubtotal(item)`, `calcularTotal(items)` según la fórmula de §3.4.
- Tests Vitest de `utils/` y `transitions.ts`. Teléfonos: casos con `336`, `3461`, `341`, `11`,
  con y sin `0`/`15`/espacios/guiones, y casos inválidos.

**apps/web**
- Vite + React + TS. Dependencias: `react-router`, `@tanstack/react-query`,
  `@fontsource-variable/archivo`. Últimas estables.
- Estructura de carpetas de `CLAUDE.md`.
- `styles/`: `index.css`, `tokens.css`, `fonts.css`, `reset.css`, `base.css`, `layout.css`
  (`l-container`, `l-stack`, `l-cluster`, `l-grid`), `utilities.css` (`u-visually-hidden`,
  `u-tabular`). Carpeta `components/` vacía. Todo según `DESIGN_SYSTEM.md`.
- Assets: copiar `docs/brand/logo.svg` e `isotipo.svg` a `src/assets/brand/`, y
  `docs/brand/favicon.svg` a `public/`.
- Router con todas las rutas de `CLAUDE.md`. Cada página es un placeholder con su título.
  `/admin/*` con `lazy`. `PublicLayout` con header (isotipo en mobile, logo en md+) y
  `AdminLayout` con nav a las secciones del panel.
- `RequireAuth` funcionando contra el login mock; 401 o token vencido → `/admin/login`.
  La página de login es funcional (form mínimo, sin diseño final).
- `services/`: `http.ts`, `queryKeys.ts`, `index.ts` (switch por `VITE_USE_MOCKS`).
- Services **api + mock** para: `GET /api/catalog`, `GET /api/slots`, `GET /api/public-settings`,
  `POST /api/orders`, `GET /api/orders/:codigo`, `POST /api/auth/login`.
- Mocks según `CLAUDE.md`:
  - Fixtures: 4 categorías (Lomitos, Hamburguesas, Milanesas, Bebidas), ~12 productos con
    `ingredientesQuitables` y extras, ~5 extras, al menos un producto `disponible: false`,
    `fotoUrl: null`, precios verosímiles en ARS enteros.
  - `settings` con los defaults de `MODELO_DATOS` §3.7.
  - Slots: generados desde `settings` para la jornada actual en `America/Argentina/Buenos_Aires`,
    respetando `intervaloMin`, `anticipacionMinMin` y cupos del store. Con
    `VITE_MOCK_FORCE_OPEN=true` ignora `horarios` y genera franjas desde ahora hasta +3 h.
  - `POST /orders` valida lo básico de §5.3 (producto activo/disponible, extras, quitados,
    aclaración, teléfono normalizado, cupo), arma snapshot y total con `calcularSubtotal`, genera
    `codigo` (8 caracteres sin ambiguos) y `numero` correlativo por jornada, setea `expiresAt` si es
    transferencia. Errores 400/409/423 con el formato de §10.
  - Login: `admin` / `admin`, token falso con `expiresAt` a 12 h.
- `QueryClientProvider` montado en `main.tsx`.
- `.env.example` con `VITE_API_URL`, `VITE_USE_MOCKS=true`, `VITE_MOCK_FORCE_OPEN=true`.
- `vercel.json` con rewrite de todo a `/index.html`.

**docs**
- `docs/ESTADO.md`: completar la tabla de etapas (00 a 08) y registrar la Etapa 02.

### No

- `apps/api` y `apps/print-server` (Etapas 05 y 07). No crear carpetas vacías.
- Componentes de UI (`components/`), pantallas reales, carrito: Etapas 03 y 04.
- Services y mocks de endpoints admin (salvo login): Etapa 04.
- Deploy en Vercel: lo configura Santiago desde el dashboard.
- Tests de `apps/web`.

## Archivos a crear o modificar

- Crear: `package.json`, `tsconfig.base.json`, `.nvmrc`, `.editorconfig`, `.prettierrc`,
  `eslint.config.js`, `.gitignore`.
- Crear: `packages/shared/**` (según estructura de `CLAUDE.md`).
- Crear: `apps/web/**` (según estructura de `CLAUDE.md`), `apps/web/vercel.json`,
  `apps/web/.env.example`.
- Modificar: `docs/ESTADO.md`.
- No modificar: `CLAUDE.md`, `docs/MODELO_DATOS.md`, `docs/DESIGN_SYSTEM.md`. Si algo no cierra, avisar.

## Criterios de aceptación

- `npm install` desde la raíz instala todo sin errores.
- `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` pasan.
- `npm run dev` levanta la app; todas las rutas de `CLAUDE.md` navegan y muestran su placeholder.
- El build separa `/admin` en chunks propios (verificable en `dist/assets`).
- `/admin` sin token redirige a `/admin/login`; con `admin`/`admin` entra y el token persiste al recargar.
- Con mocks: se puede crear un pedido desde la consola o un botón de prueba en `/checkout`
  (placeholder), navegar a `/pedido/:codigo` y ver el JSON del pedido después de recargar.
- Crear pedidos hasta llenar una franja devuelve 409 con el formato de §10.
- Ningún color, espaciado ni radio hardcodeado fuera de `tokens.css`.
- Ningún componente importa `fetch` ni un service directo.
- Los JSON de los mocks coinciden campo por campo con los contratos de `MODELO_DATOS` §6–7.

## Al terminar

Actualizar `docs/ESTADO.md`: tabla de etapas completa (02 ✅), entrada en el registro con lo
hecho y cualquier desvío respecto de este brief o de los docs.
