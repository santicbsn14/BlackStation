# Brief — Etapa 02b: ajustes post-revisión

## Objetivo

Alinear `packages/shared` y los mocks de `apps/web` con los cambios de `docs/MODELO_DATOS.md`
surgidos de la revisión de la Etapa 02.

## Docs a leer

1. `docs/MODELO_DATOS.md`: §3.4 (`codigo`), §5.1 y §5.3 (pedidos solo con el local abierto),
   §6 (`GET /api/slots` con `abierto`), §8.2 (listas admin envueltas), §10 (códigos de error).
2. `docs/DESIGN_SYSTEM.md` §8 (excepción de `@layer` para `tokens.css` y `fonts.css`).
3. `docs/ESTADO.md`: desvíos de la Etapa 02.

## Alcance

### Sí

- **shared:** `ERROR_CODES` (`as const`) + tipo `ErrorCode` con la tabla de §10.
  `ApiErrorBody.code` pasa a `ErrorCode`.
- **shared:** `SlotsResponse` suma `abierto: boolean`.
- **shared:** respuestas de `GET /api/admin/{categories,products,extras}` como
  `{ categories }`, `{ products }`, `{ extras }`.
- **mocks:** `POST /orders` devuelve 423 `CLOSED` también cuando la hora actual está fuera de
  `abre`–`cierra` de la jornada actual (con cruce de medianoche). `VITE_MOCK_FORCE_OPEN=true`
  sigue ignorando horarios.
- **mocks:** `GET /slots` devuelve `abierto` y, si es `false`, `slots: []`.
- **mocks:** usar las constantes de `ERROR_CODES` en vez de strings sueltos.

### No

- Pantallas, componentes, services o mocks admin (Etapas 03 y 04).
- Quitar el botón de prueba de `/checkout` (se reemplaza en la Etapa 03).

## Archivos a crear o modificar

- Modificar: `packages/shared/src/types/*` que correspondan, `packages/shared/src/index.ts`.
- Crear: `packages/shared/src/errors.ts` (o donde encaje según la estructura de `CLAUDE.md`).
- Modificar: `apps/web/src/services/mocks/**`.
- Modificar: `docs/ESTADO.md`.
- No modificar: `CLAUDE.md`, `docs/MODELO_DATOS.md`, `docs/DESIGN_SYSTEM.md`.

## Criterios de aceptación

- `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` pasan.
- Con `VITE_MOCK_FORCE_OPEN=false` y la hora fuera de horario: `GET /slots` → `abierto: false`,
  `slots: []`; `POST /orders` → 423 `CLOSED`.
- Con `VITE_MOCK_FORCE_OPEN=true` todo sigue funcionando como hasta ahora.
- Ningún `code` de error escrito como string suelto en los mocks.
- Tests de shared siguen pasando (sumar uno que valide que `ERROR_CODES` no tiene duplicados).

## Al terminar

Entrada corta en `docs/ESTADO.md` (Etapa 02b) con lo hecho y desvíos. Marcar como resueltos los
desvíos de la Etapa 02 que cubre este brief.
