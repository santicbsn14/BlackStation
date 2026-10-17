# Brief 05d — Franjas, creación del pedido, seguimiento público y vencimiento

## Objetivo
Implementar en la API el flujo público completo:
- `GET /api/slots`.
- `POST /api/orders`: reserva atómica de cupo, número por jornada, snapshot de precios, reglas del customer y topes anti-spam.
- `GET /api/orders/:codigo` y `POST /api/orders/:codigo/cancelar`.

En el panel, `GET /api/admin/slots` y `PATCH /api/admin/slots`. Además, el vencimiento de transferencias (perezoso + job cada 1 minuto).
En el front, servir las fotos de Cloudinary optimizadas en lugar del original.

Con esto, un cliente puede hacer un pedido real desde la web pública.
Guardá este brief en `docs/briefs/etapa-05d-franjas-pedidos.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3.4–3.6, §4, §5.1–5.5, §6, §8.3, §10), docs/ESTADO.md.

Reglas y mensajes de referencia (la API responde los mismos `code` y `message`):
- `apps/web/src/services/mocks/index.ts`: `getSlots`, `armarItems`, `reservarCupo`, `createOrder`, `getOrderByCodigo`, `cancelOrder`, `toPublicOrder`.
- `apps/web/src/services/mocks/common.ts`: `vencerPendientes`, `liberarCupo`, `franjasConCupo`, `cumpleAnticipacion`, `upsertCustomer`.
- `apps/web/src/services/mocks/admin.ts`: `getAdminSlots`, `esHuerfana`, `updateSlot`.

Utils de shared a reutilizar (no duplicar): `getJornada`, `getFranjasDeFecha`, `calcularSubtotal`, `calcularTotal`, `TELEFONO_REGEX`, `ACLARACION_MAX`.

## Alcance

### 1. docs/MODELO_DATOS.md (primero)
- §5.3, topes anti-spam. Se chequean después de validar el formato del body y antes de reservar cupo:
  - **Por teléfono:** si `cliente.telefono` ya tiene 2 pedidos `pendiente` (contados en la base, después del vencimiento perezoso) → 429 `TOO_MANY_ORDERS`, con el mensaje `Ya tenés 2 pedidos en curso. Esperá a que los confirmen o cancelá uno.`.
  - **Por IP:** máximo 10 pedidos **creados** por IP por hora, con una ventana móvil que arranca en el primero. Si se pasa → 429 `TOO_MANY_ORDERS`, con el mensaje `Hiciste muchos pedidos seguidos. Probá de nuevo más tarde.` y el header `Retry-After`. El contador vive en memoria, como `loginLimiter`, y solo suma los pedidos creados con éxito.
- §5.4, vencimiento perezoso: `vencerPendientes()` lleva a `cancelado`/`vencido` todo pedido `pendiente` con `expiresAt ≤ now()` y libera su cupo.
  - Corre al inicio de `GET /api/slots`, `POST /api/orders`, `GET /api/orders/:codigo`, `POST /api/orders/:codigo/cancelar` y `GET`/`PATCH /api/admin/slots`.
  - Además corre en el job cada 1 minuto.
  - Así ningún pedido vencido se ve ni se opera como `pendiente` mientras el job no pasa, igual que en el mock.
- §5.3, generación del `codigo`: `crypto.randomInt` sobre el alfabeto de §3.4. Si choca con el índice único, se reintenta hasta 5 veces.
- §5.3, falla después de reservar: si algo falla entre la reserva y el insert del pedido, se libera el cupo (§3.5 paso 3). El número tomado queda salteado (§3.9).
- §8.2 (nota de entrega): el front pide las fotos a Cloudinary con `f_auto,q_auto,w_<ancho>,c_limit`. La API sigue guardando y devolviendo la URL original.
- §10: code `TOO_MANY_ORDERS` (429).

### 2. @blackstation/shared
- `TOO_MANY_ORDERS` en `ERROR_CODES` y `ERROR_STATUS` (429), con test.
- `utils/foto.ts`: `fotoCloudinary(url, ancho)`.
  - Si la URL es de `res.cloudinary.com` y tiene `/upload/`, inserta `f_auto,q_auto,w_<ancho>,c_limit/` justo después de `/upload/`.
  - Cualquier otra URL (las data URL de los mocks, por ejemplo) se devuelve igual.
  - Exportada desde el index, con test en `utils/foto.test.ts`.

### 3. apps/api
- `services/jornada.ts`: `jornadaActual(settings)` = `getJornada(settings, now(), env.FORCE_OPEN)`.
- `services/vencimiento.ts`: `vencerPendientes()`.
  - Por cada candidato: `findOneAndUpdate({ _id, estado: 'pendiente', expiresAt: { $lte: now } })` → `cancelado`, `motivoCancelacion: 'vencido'`, `canceladoAt`.
  - Solo si matcheó, libera el cupo. Así no se libera dos veces aunque corran el job y una request a la vez.
- `jobs/vencimiento.ts`: `startVencimientoJob()`.
  - `setInterval` de 60 s con `unref`.
  - Se arranca en `index.ts`, no en `createApp`, para que los tests no lo prendan. Se frena en el shutdown.
  - Si una corrida tira error, va al log y no corta las siguientes.
- `services/slots.ts`:
  - `franjasConCupo(fecha, franjas)`: une las franjas posibles con los documentos de `pickupSlots`.
  - `reservarCupo(fecha, franja)`: los dos pasos de §3.5. Si no matchea → 409 `SLOT_CLOSED` o `SLOT_FULL`, según el estado del documento.
  - `liberarCupo(slotId)`: `$inc: -1` con condición `ocupados > 0`.
  - Panel: `getAdminSlots(fecha?)` (unión + `huerfana`) y `updateSlot(...)`, con las reglas y mensajes del mock.
  - En `updateSlot`, el cambio de `cupoMax` va con condición atómica `ocupados ≤ cupoMax nuevo`; si no matchea → 400 `CUPO_BELOW_OCUPADOS`.
- `services/orders.ts`:
  - `createOrder(input, ip)`: sigue el orden de §5.3, con los topes después del paso 4.
  - Snapshot y total con precios de la base, armados como `armarItems` del mock y con `calcularSubtotal`/`calcularTotal`.
  - `expiresAt` = creación + `minutosTransferencia` (solo transferencia).
  - Customer: upsert por `telefono` con `nombre`, `nombreBusqueda`, `pedidosTotal++` y `ultimoPedidoAt`.
  - Responde `201 { codigo, numero, estado, horaRetiro, total, expiresAt }`.
  - `getPublicOrder(codigo)`.
  - `cancelPublicOrder(codigo)`: con condición `estado: 'pendiente'`. Libera el cupo y no toca `customers`.
- `lib/orderLimiter.ts`: el tope por IP, con la misma forma que `loginLimiter`.
- Mappers y validators:
  - `toPublicOrder` y `toSlot`, con los recortes explícitos según los tipos de shared.
  - Errores de formato con los `code` específicos de §10 (`INVALID_NOMBRE`, `INVALID_TELEFONO`, `INVALID_ACLARACION`, `INVALID_METODO_PAGO`, `EMPTY_ORDER`, `INVALID_QUANTITY`…) y los mensajes del mock.
- Rutas: `routes/public.ts` suma `slots` y `orders`. Nueva `routes/admin/slots.ts`.

### 4. apps/web (mínimo)
- `features/public/checkout/hooks/useCheckoutForm.ts`: para `TOO_MANY_ORDERS`, `toast(error.message)` en lugar del mensaje genérico.
- Fotos optimizadas con `fotoCloudinary` de shared:
  - `ProductoCard`: ancho 400.
  - `ProductoSheet`: ancho 800.
  - Miniaturas del panel en `ProductosTab` y `ProductoDrawer`: ancho 200.
  - No cambia el valor que se guarda ni el que se manda en el `PUT`: solo el `src` de las `<img>`.
- Los mocks no implementan los topes.

### Fuera de alcance
- Pedidos del panel: lista, `?since=`, transiciones, extender, reimprimir.
- Endpoints del print server, clientes del panel y reputación.

## Archivos a crear o modificar
- Crear:
  - Los de §3.
  - `packages/shared/src/utils/foto.ts` + `foto.test.ts`.
  - Tests: `apps/api/test/slots.test.ts`, `orders.create.test.ts`, `orders.public.test.ts`, `vencimiento.test.ts`, `orderLimiter.test.ts`.
  - `docs/briefs/etapa-05d-franjas-pedidos.md`.
- Modificar:
  - `apps/api/src/index.ts` (job), `routes/public.ts`, `routes/admin/index.ts`.
  - `packages/shared/src/errors.ts` + test, `packages/shared/src/index.ts`.
  - `useCheckoutForm.ts`, `ProductoCard.tsx`, `ProductoSheet.tsx`, `ProductosTab.tsx`, `ProductoDrawer.tsx`.
  - `docs/MODELO_DATOS.md`, `docs/ESTADO.md`.

## Criterios de aceptación
Supertest + mongodb-memory-server, con el reloj fijado con `setClock` en una jornada abierta de los defaults de §3.7.

**Slots públicos**
- Fuera de horario, día inactivo o `pedidosHabilitados: false` → `abierto: false` y `slots: []`.
- Abierto:
  - Solo franjas que cumplen la anticipación, no cerradas y con cupo.
  - `disponibles = cupoMax − ocupados`.
  - En una jornada que cruza la medianoche, las franjas después de las 00:00 traen el `inicio` correcto.

**Creación**
- Pedido válido:
  - 201, con `numero` 1 y después 2.
  - `codigo` de 8 caracteres del alfabeto.
  - `ocupados` +1.
  - Customer creado con `pedidosTotal: 1` y `nombreBusqueda`.
- Snapshot:
  - Los precios salen de la base aunque el body mande otros.
  - `subtotal` y `total` correctos con extras y cantidades.
- Cada validación de §5.3 con su code y status:
  - Pedidos deshabilitados → 423. Local cerrado → 423.
  - Customer bloqueado → 403. `requiereTransferencia` pidiendo retiro → 403.
  - Producto inactivo, agotado o de categoría inactiva → 400 `PRODUCT_UNAVAILABLE`.
  - Quitado inválido, extra fuera de `extrasIds`, cantidad de extra fuera de rango.
  - Aclaración de 141 caracteres, nombre vacío, teléfono inválido, método inválido, pedido sin ítems.
  - Hora inexistente → `INVALID_SLOT`. Franja sin anticipación → `SLOT_TOO_SOON`.
  - Franja cerrada → 409 `SLOT_CLOSED`. Franja llena → 409 `SLOT_FULL`.
- **Concurrencia:** franja con `cupoMax: 2` y 5 pedidos en paralelo:
  - Exactamente 2 dan 201 y 3 dan 409 `SLOT_FULL`.
  - `ocupados` queda en 2.
  - Los números son únicos.
- Insert que falla después de reservar (forzado en el test) → `ocupados` vuelve al valor anterior.
- Transferencia → `expiresAt` = creación + `minutosTransferencia`. Retiro → `expiresAt: null`.

**Topes**
- Tercer pedido `pendiente` del mismo teléfono → 429 `TOO_MANY_ORDERS`. Si cancela uno, el siguiente pasa.
- Pedido número 11 de la misma IP en una hora → 429 con `Retry-After`. Pasada la hora, pasa. Otra IP no se ve afectada.

**Seguimiento y cancelación**
- `GET /api/orders/:codigo` → `PublicOrder` sin `telefono`. Si no existe → 404 `ORDER_NOT_FOUND`.
- `POST .../cancelar`:
  - Pendiente → `cancelado`/`cliente`, libera el cupo y el customer no cambia.
  - Confirmado o ya cancelado → 409 `INVALID_TRANSITION`.

**Vencimiento**
- Con el reloj después de `expiresAt`:
  - `GET /api/orders/:codigo` ya lo devuelve `cancelado`/`vencido` y el cupo quedó liberado.
  - Cancelarlo → 409.
- `vencerPendientes()` corrido dos veces en paralelo libera el cupo una sola vez.
- Un pedido de retiro nunca vence.

**Slots admin**
- `GET` → unión con `huerfana`, igual que el mock.
- `PATCH`:
  - Crea el documento si no existe.
  - `cupoMax < ocupados` → 400 `CUPO_BELOW_OCUPADOS`.
  - Una franja cerrada deja de ofrecerse en `GET /api/slots`.

**Fotos**
- `fotoCloudinary('https://res.cloudinary.com/x/image/upload/v1/blackstation/products/a.jpg', 400)` → `https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_400,c_limit/v1/blackstation/products/a.jpg`.
- Una data URL o una URL de otro dominio vuelve igual.

**Manual** (API con `FORCE_OPEN=true`, web con `VITE_USE_MOCKS=false` + `VITE_FORCE_OPEN=true`)
- Hacer un pedido desde `/` → checkout → llega a `/pedido/:codigo` con número y hora.
- Cancelarlo desde ahí.
- En `/admin/franjas` se ve la ocupación. La comanda todavía da error; llega en la 05e.
- En la pestaña Network, las fotos del catálogo se piden con `f_auto,q_auto,w_400` y pesan decenas de KB, no MB.

`npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
Actualizar `docs/ESTADO.md` (entrada 05d con lo hecho y los desvíos), commit `feat: franjas y pedidos (05d)` y `git push` a `main`.
