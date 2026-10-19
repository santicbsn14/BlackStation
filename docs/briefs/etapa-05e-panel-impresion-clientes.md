# Brief 05e — Pedidos del panel, cola de impresión y clientes

## Objetivo
Terminar la API del panel:
- **Comanda:** `GET /api/admin/orders` con polling incremental `?since=`, transiciones de estado con sus efectos, extender el plazo y reimprimir.
- **Print server:** `GET /api/print/queue` y `POST /api/print/:id/ack`, con `X-Print-Key`.
- **Clientes:** `GET /api/admin/customers?q=` (sin tildes) y `PATCH /api/admin/customers/:telefono`.

Con esto, todos los endpoints de MODELO_DATOS §6–9 quedan implementados y el panel funciona entero contra la API real.
Guardá este brief en `docs/briefs/etapa-05e-panel-impresion-clientes.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3.4, §3.6, §4, §5.4, §5.6, §5.7, §8.1, §8.5, §9, §10), docs/ESTADO.md.

Referencia de reglas y mensajes (la API responde los mismos `code` y `message`), en `apps/web/src/services/mocks/admin.ts`:
- `getAdminOrders` (incluye `MARGEN_SINCE_MS`), `updateOrderEstado`, `extendOrder`, `reprintOrder`
- `getCustomers`, `updateCustomer`

En `apps/web/src/services/mocks/common.ts`: `sumarAlCustomer`.

De shared se reutilizan `puedeTransicionar`, `MOTIVOS_CANCELACION_PANEL` (o el equivalente que exista) y los tipos de `orders` y `customers`. De la 05d se reutilizan `vencerPendientes`, `liberarCupo`, `jornadaActual` y `requirePrintKey`.

## Alcance

### 1. docs/MODELO_DATOS.md (primero)
- §8.1 `GET /api/admin/orders`:
  - Sin `fecha`, la jornada actual (respeta `FORCE_OPEN`).
  - Orden por `createdAt`.
  - `serverTime` = `now()` tomado **antes** de la query, menos 2 s de margen. Así no se pierde una escritura que se confirme mientras corre la consulta. Traer de nuevo algo que ya estaba no molesta, porque el panel mergea por `_id`.
  - `fecha`, `estado` y `since` inválidos → 400 `VALIDATION_ERROR` con los mensajes del mock.
- §8.1 `PATCH .../estado`:
  - Primero se valida con `puedeTransicionar(actual, nuevo, motivo, 'panel')`.
  - Se aplica con `findOneAndUpdate` condicionado al **estado leído**. Si no matchea porque cambió en el medio, 409 `INVALID_TRANSITION` con `El pedido cambió de estado y ya no admite esa acción.`
  - Los efectos de §4 corren **solo si el update matcheó**:
    - `confirmado` → `confirmadoAt`, `impresoAt: null`.
    - `entregado` → `entregadoAt` y `customers.entregados++`.
    - `cancelado` → `canceladoAt`, `motivoCancelacion` y se libera el cupo; si el motivo es `no_retiro`, además `customers.noShows++`.
- §8.1 `POST .../reprint`: va con condición atómica `estado: 'confirmado'`. Si no matchea → 409 `NOT_CONFIRMED` (`Solo se reimprimen pedidos confirmados.`).
- §9 `GET /api/print/queue`:
  - Solo pedidos de la **jornada actual**, en `confirmado` y con `impresoAt: null`, ordenados por `confirmadoAt`.
  - Los de jornadas anteriores no se imprimen solos; si hace falta, se reimprimen desde el panel.
- §9 `POST /api/print/:id/ack`:
  - Pedido inexistente → 404 `ORDER_NOT_FOUND`.
  - Pedido `confirmado` → setea `impresoAt = now()`. Es idempotente: si ya tenía `impresoAt`, devuelve el que tiene.
  - Pedido en otro estado (por ejemplo, cancelado mientras se imprimía) → 409 `NOT_CONFIRMED`.
- §8.5 `GET /api/admin/customers`:
  - `q` solo dígitos → `telefono` contiene `q`.
  - Si no → regex sobre `nombreBusqueda`, con `q` pasado por `normalizarBusqueda` + `escaparRegex`.
  - Orden por `ultimoPedidoAt` desc (los `null` al final) y tope de 50.
  - `nombreBusqueda` nunca sale en la respuesta.
- §5.3 (corrección de la 05d): si el upsert del customer falla **después** de crear el pedido, el error va al log y la respuesta sigue siendo 201. El pedido ya existe y un 500 haría que el cliente reintente y lo duplique.

### 2. apps/api
- `services/orders.ts`, nuevas funciones:
  - `getAdminOrders(query)`
  - `updateOrderEstado(id, input)`
  - `extendOrder(id)`: §8.1, ya definido; mensajes del mock.
  - `reprintOrder(id)`
  - Los cuatro arrancan con `vencerPendientes()`, igual que el mock.
  - Además, el cambio de §1 en `createOrder`.
- `services/customers.ts`:
  - `sumarAlCustomer(telefono, 'entregados' | 'noShows')`
  - `getCustomers(q?)`
  - `updateCustomer(telefono, input)`: reglas de `estadoManual` iguales al mock.
- `services/print.ts`: `getPrintQueue()` y `ackPrint(id)`.
- Mappers:
  - `toAdminOrder`: el `Order` completo de shared.
  - `toCustomer`: sin `nombreBusqueda`.
- Validators: `adminOrdersQuery`, `updateOrderEstadoBody`, `customersQuery`, `updateCustomerBody` y `:id`/`:telefono`.
  - Un `:id` mal formado → 404 `ORDER_NOT_FOUND`.
  - Un `:telefono` que no cumple `TELEFONO_REGEX` → 404 `CUSTOMER_NOT_FOUND`.
- Rutas:
  - `routes/admin/orders.ts` y `routes/admin/customers.ts`, montadas en `routes/admin/index.ts`.
  - `routes/print.ts` en `/api/print`, con `requirePrintKey` en todo el router.

### Fuera de alcance
- Reglas automáticas de reputación (Etapa 06) y el print server (Etapa 07).
- Deploy (05f).
- Cambios en el front: `services/api` ya implementa todos estos endpoints.

## Archivos a crear o modificar
- Crear:
  - Los de §2.
  - Tests: `apps/api/test/orders.admin.test.ts`, `print.test.ts`, `customers.test.ts`.
  - `docs/briefs/etapa-05e-panel-impresion-clientes.md`.
- Modificar: `services/orders.ts`, `routes/admin/index.ts`, `app.ts` (monta `/api/print`), `docs/MODELO_DATOS.md`, `docs/ESTADO.md`.

## Criterios de aceptación
Supertest + mongodb-memory-server, con el reloj fijado con `setClock`.

**Lista y polling**
- Sin query → solo los pedidos de la jornada actual, ordenados por `createdAt`.
- `?estado=pendiente` filtra por estado.
- `?fecha=` de otra jornada → los pedidos de esa jornada.
- `serverTime` es `now − 2 s`.
- Con `?since=<serverTime anterior>` vuelven solo los pedidos con `updatedAt` posterior, incluido uno que se confirmó entre las dos consultas.
- Sin token → 401.

**Transiciones**
Cada transición válida de §4 aplica sus efectos:
- Confirmar → `confirmadoAt`, `impresoAt: null`, y aparece en la cola.
- Entregar → `entregados` +1.
- Cancelar `manual` desde pendiente y desde confirmado → libera el cupo; los contadores no cambian.
- Cancelar `no_retiro` → libera el cupo y suma `noShows` +1.

Inválidas → 409 `INVALID_TRANSITION`:
- Entregar un pendiente.
- Cualquier cambio sobre un entregado o un cancelado.
- Usar el motivo `vencido` o `cliente` desde el panel.

Cancelar sin motivo → 400 `VALIDATION_ERROR`.

**Concurrencia:**
- Dos `PATCH` simultáneos sobre el mismo pendiente (confirmar y cancelar) → uno da 200 y el otro 409, y los efectos se aplican una sola vez.
- Confirmar un pendiente vencido (reloj pasado de `expiresAt`) → 409, porque ya está cancelado/vencido.

**Extender**
- Pendiente de transferencia → `expiresAt = max(expiresAt, now) + minutosTransferencia`.
- Uno de retiro → 409 `NOT_EXTENDABLE`.
- Uno vencido → 409 `INVALID_TRANSITION`.

**Reimprimir**
- Confirmado → `impresoAt: null` y vuelve a la cola.
- Pendiente → 409 `NOT_CONFIRMED`.

**Print server**
- Sin `X-Print-Key` o con una clave incorrecta → 401.
- La cola trae solo confirmados sin imprimir de la jornada actual: un confirmado sin imprimir de ayer no aparece.
- Está ordenada por `confirmadoAt`.
- `ack`:
  - Setea `impresoAt` y el pedido sale de la cola.
  - Un segundo `ack` devuelve el mismo `impresoAt`.
  - Sobre un cancelado → 409.
  - Sobre un id inexistente → 404.

**Clientes**
- `?q=juan` encuentra a "Juán Pérez".
- `?q=336` encuentra por teléfono.
- `?q=a` → 400.
- `?q=.*` no rompe: lo busca como texto literal.
- Orden por `ultimoPedidoAt` desc y tope de 50.
- La respuesta no trae `nombreBusqueda`.
- `PATCH`:
  - Cambiar `estado` pone `estadoManual: true`, salvo que venga `estadoManual: false`.
  - Body sin cambios → 400.
  - Teléfono inexistente → 404 `CUSTOMER_NOT_FOUND`.

**Corrección de la 05d**
- Si el upsert del customer falla (forzado en el test) → la respuesta es 201 y el pedido existe.

**Manual** (`FORCE_OPEN=true`, web con `VITE_USE_MOCKS=false` + `VITE_FORCE_OPEN=true`)
- Hacer un pedido desde `/`. Aparece en la comanda en ≤ 10 s, sin recargar y con el sonido.
- Confirmar, entregar, cancelar y extender desde la comanda.
- La pantalla `/pedido/:codigo` del cliente refleja cada cambio.
- `/admin/clientes` busca sin tildes y cambia el estado.
- Los pedidos confirmados quedan "sin imprimir" hasta la Etapa 07, y es esperado.

`npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
- Actualizar `docs/ESTADO.md`: entrada 05e con lo hecho y los desvíos.
- Commit `feat: panel, impresión y clientes (05e)` y `git push` a `main`.
