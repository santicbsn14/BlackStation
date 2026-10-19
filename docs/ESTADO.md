# Black Station — Estado del proyecto

## Etapas

| Etapa | Descripción | Estado |
|---|---|---|
| 00 | Definición del proyecto: alcance, stack y documentación base | ✅ Cerrada |
| 01 | Modelo de datos, estados, reglas de negocio y endpoints | ✅ Cerrada |
| 02 | Setup del monorepo: `shared`, design system base, routing, servicios y mocks | ✅ Cerrada |
| 02b | Ajustes post-revisión: códigos de error, `abierto` en slots, listas admin envueltas | ✅ Cerrada |
| 03 | App pública: catálogo, carrito, checkout y seguimiento del pedido | ✅ Cerrada — [Demo 1](https://black-station-web.vercel.app/), diseño aprobado por la clienta |
| 03c | Repaso antes de enviar + cancelación por el cliente | ✅ Cerrada |
| 04 | Panel: login, comanda, catálogo, franjas, clientes y ajustes (+ services/mocks admin) | ✅ Cerrada — Demo 2 aprobada por la clienta con el ajuste de 04e |
| 05 | API (`apps/api`): Express por capas, MongoDB, auth y job de vencimiento | En curso — 05a a 05e cerradas; falta el deploy (05f) |
| 06 | Reglas de reputación de clientes | Pendiente |
| 07 | Print server (`apps/print-server`): ESC/POS + PM2 | Pendiente |
| 08 | Pulido y salida a producción (marca definitiva, settings reales) | Pendiente |

## Documentos

- [MODELO_DATOS.md](MODELO_DATOS.md) — fuente de verdad del modelo de datos, estados,
  reglas de negocio y endpoints.
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — arquitectura CSS, tokens y reglas de estilos.

## Cómo correr la Demo 2 (con mocks)

1. `apps/web/.env`: `VITE_USE_MOCKS=true`, `VITE_MOCK_SIMULAR=true` y, para probar de día,
   `VITE_FORCE_OPEN=true` (con `false` se respetan los horarios reales: martes a domingo
   20:00–00:30).
2. `npm run dev` desde la raíz.
3. Dos pestañas del mismo navegador (comparten el store `bs-mock-db`):
   - Pública: `http://localhost:5173/` (catálogo, checkout, seguimiento).
   - Panel: `http://localhost:5173/admin`, usuario `admin`, contraseña `admin`.
4. Con el panel abierto, el simulador crea un pedido cada 30–60 s; los de la pestaña pública
   aparecen en la comanda en ≤ 5 s. Para arrancar de cero: borrar `bs-mock-db` del `localStorage`.

En Vercel las mismas variables van en el dashboard.

## Registro de cambios

### 2026-10-19 — Etapa 05e: panel, impresión y clientes
- `MODELO_DATOS.md`: §8.1 (lista y polling con `serverTime = now − 2 s` tomado antes de la query,
  validaciones y mensajes, transiciones con condición sobre el estado leído y efectos solo si el
  update matcheó, reprint atómico), §8.5 (búsqueda, orden con `null` al final, validaciones del
  `PATCH`, 404 por `:telefono`), §9 (cola solo de la jornada actual, `ack` idempotente y 409 si ya no
  está confirmado), §5.3 (falla del upsert del customer → log y 201), §5.4 (vencimiento perezoso en
  `/api/admin/orders`) y §10 (`NOT_CONFIRMED` también para el `ack`).
- `apps/api`: `GET /api/admin/orders`, `PATCH .../estado`, `PATCH .../extender`,
  `POST .../reprint`, `GET`/`PATCH /api/admin/customers`, `GET /api/print/queue` y
  `POST /api/print/:id/ack` (router con `requirePrintKey`). `services/{customers,print}`, funciones
  nuevas en `services/orders`, `mappers/customers` (`toCustomer`) y `toAdminOrder`,
  `validators/customers` y los validators del panel en `validators/orders`, controllers y routes.
- `createOrder`: si el upsert del customer falla después del insert, `console.error` y 201.
- Con esto están todos los endpoints de §6–9.
- Tests de la api: 367 (+76): lista, filtros, `serverTime`, `since` con un pedido confirmado entre
  consultas, cada transición con sus efectos, las inválidas, concurrencia (confirmar + cancelar a la
  vez con una barrera que obliga a las dos a leer `pendiente`; dos `no_retiro`; dos entregar),
  vencido, extender, reprint, cola (ayer no entra, orden por `confirmadoAt`), `ack` (idempotente,
  cancelado, 404), clave del print server, búsqueda de clientes (tildes, teléfono, `.*`, tope y orden),
  `PATCH` de clientes y la falla forzada del upsert del customer.
- typecheck, lint, test, `build` y `build:api` pasan.

**Desvíos y decisiones a revisar**
- **Motivo `vencido`/`cliente` desde el panel → 409** (como pide el brief), no 400 como el mock: el
  body acepta cualquier motivo de §3.4 y `puedeTransicionar` lo rechaza. Sin motivo o con uno que no
  existe → 400 con el mensaje del mock. El mock quedó sin tocar (cambios de front fuera de alcance).
- Mensaje nuevo, sin equivalente en el mock: `El pedido ya no está confirmado.` (`ack` sobre un
  pedido que no está `confirmado`).
- `ack` también actualiza `updatedAt`, para que el panel vea "impreso" por polling. Si justo lo
  reimprimieron entre el update y la relectura, reintenta.
- Extender usa el `expiresAt` leído para calcular el nuevo: dos extensiones simultáneas pueden contar
  como una (aceptado; el update sigue condicionado a `pendiente`, como dice §8.1).
- `reprint` ahora corre el vencimiento perezoso (el mock no), como pide el brief para los cuatro.
- Transición sobre un pedido cuyo customer no existe: cambia el estado y no crea el customer, igual
  que `sumarAlCustomer` del mock.
- **Sin verificar (manual del brief):** el flujo en el navegador con `VITE_USE_MOCKS=false` (pedido
  desde `/` que aparece en la comanda con sonido, acciones de la comanda, `/pedido/:codigo` y
  `/admin/clientes`). No se levantó la API contra Atlas en esta sesión; todo lo de arriba está
  cubierto por supertest.

### 2026-10-17 — Etapa 05d: franjas y pedidos
- `MODELO_DATOS.md`: §5.3 (topes anti-spam por teléfono e IP, generación del `codigo` con
  reintentos, liberar el cupo si falla después de reservar), §5.4 (vencimiento perezoso y condición
  para no liberar dos veces), §8.2 (entrega de fotos con `f_auto,q_auto,w_<ancho>,c_limit`), §8.3
  (validaciones y mensajes del `PATCH`, `cupoMax` atómico, `huerfana` con `FORCE_OPEN`), §6 y §10
  (`TOO_MANY_ORDERS`, 429).
- `shared`: `TOO_MANY_ORDERS` en `ERROR_CODES`/`ERROR_STATUS` y `utils/foto.ts`
  (`fotoCloudinary`), con tests. 79 tests (+7).
- `apps/api`: `GET /api/slots`, `POST /api/orders`, `GET /api/orders/:codigo`,
  `POST /api/orders/:codigo/cancelar`, `GET`/`PATCH /api/admin/slots`. `services/{jornada,slots,
  orders,vencimiento}`, `jobs/vencimiento` (cada 60 s, arrancado en `index.ts` y frenado en el
  shutdown), `lib/orderLimiter`, `mappers/{orders,slots}`, `validators/{orders,slots}`, controllers y
  routes.
- `apps/web`: `TOO_MANY_ORDERS` muestra su mensaje en un toast; las `<img>` de `ProductoCard` (400),
  `ProductoSheet` (800), `ProductosTab` y `ProductoDrawer` (200) usan `fotoCloudinary`.
- Tests de la api: 291 (+112) — franjas públicas y admin, creación con cada validación de §5.3 y su
  mensaje, snapshot, concurrencia (5 pedidos contra cupo 2, con y sin documento previo), insert que
  falla, `codigo` repetido, topes, seguimiento, cancelación (también dos a la vez), vencimiento
  perezoso, `vencerPendientes()` en paralelo, el job y el limiter.
- typecheck, lint, test, `build` y `build:api` pasan. Probado por HTTP con `FORCE_OPEN=true` contra
  Atlas `blackstation-dev`: slots, pedido creado (número 1), seguimiento, cancelación y 409 al
  cancelar de nuevo. Quedaron en esa base un pedido cancelado, su franja (`ocupados: 0`), el contador
  y el customer `5493369999999` ("Prueba 05d").

**Desvíos y decisiones a revisar**
- **Orden de validación:** el controller solo normaliza la forma del body (nunca falla); los
  chequeos con `code` específico corren en el service en el orden de §5.3 (`validarDatosPedido` vive
  en `validators/orders`). Así un local cerrado da 423 aunque el body tenga errores, como el mock.
- Body mal formado (no es el que manda el front): sin `items` o `items` que no es array →
  `EMPTY_ORDER`; ítem que no es objeto o `productoId` mal formado → `PRODUCT_UNAVAILABLE`; `quitados`
  no array → `INVALID_REMOVED`; `extras` no array o `extraId` mal formado → `EXTRA_UNAVAILABLE`;
  `aclaracion` que no es string → `INVALID_ACLARACION` `La aclaración no es válida.` (mensaje nuevo);
  `hora` ausente → `INVALID_SLOT`. `quitados` y `extras` ausentes cuentan como `[]`.
- `:codigo` con formato que no es del alfabeto → 404 sin consultar la base.
- `AppError` suma `retryAfter` opcional y el `errorHandler` pone el header `Retry-After` (el login
  lo sigue poniendo en su controller).
- Los topes se chequean después del paso 4 y antes del paso 5 (franja). El tope por IP no es
  atómico: varios pedidos simultáneos de la misma IP pueden pasar el chequeo juntos (aceptado).
- `codigo`: 1 intento + 5 reintentos si choca con el índice único; después, 500 y se libera el cupo.
- Si el upsert del customer falla después del insert, el pedido queda creado y la respuesta es 500
  (no se deshace el pedido).
- `cuerpo`, `esHora` y `esFecha` pasan a `validators/common.ts` (antes en catalog/settings);
  `findSettings` se exporta desde `services/settings`. `franjasConCupo` recibe además
  `cupoMaxDefault`. Hay un import circular `slots` ↔ `vencimiento` (solo funciones, sin efecto).
- `PATCH /admin/slots` valida el formato antes de vencer pendientes (el mock vence primero; sin
  diferencia en la respuesta).
- **Sin verificar en el navegador:** el manual del brief (pedido desde `/` con `VITE_USE_MOCKS=false`,
  `/admin/franjas` y el peso de las fotos en Network). Se probó el flujo por HTTP, no la UI.

### 2026-10-16 — Etapa 05c: catálogo y Cloudinary
- `MODELO_DATOS.md`: §6 (órdenes `(orden, _id)` del catálogo, extras en el orden de `extrasIds`,
  categorías sin productos, campos que no se exponen) y §8.2 (orden de las listas admin, tabla de
  validaciones con los mensajes de los mocks, 404 por `:id`, reglas de fotos, borrado de la foto
  vieja y firma de subida).
- `apps/api`: `GET /api/catalog`; CRUD de `/api/admin/{categories,products,extras}` con borrado
  soft, reactivación por `PUT` y `PATCH .../disponible`; `POST /api/admin/uploads/signature`.
  `lib/cloudinary` (`firmarParams`, `destroyImage` con `fetch`, `esFotoPropia`), `mappers/catalog`,
  `validators/catalog`, `services/{catalog,uploads}`, controllers y routes. Un `PUT` que cambia o
  saca la foto borra la anterior en Cloudinary en segundo plano (si falla, solo log).
- Tests de la api: 179 (+88) — catálogo público (igual al `getCatalog` del mock armado desde los
  JSON del seed, filtros, órdenes, recorte), CRUD de las tres entidades, cada validación con su
  mensaje, 404 por `:id`, 401 en las 15 rutas admin nuevas, fotos (400, destroy sí/no, destroy que
  falla), firma contra un sha1 calculado a mano y `lib/cloudinary`. Ningún test sale a la red.
- `npm run format` aplicado (`seed/runSeed.ts` y `test/models.test.ts`, pendiente de la 05a).
- typecheck, lint, test, `build` y `build:api` pasan. Con `npm run dev:api` contra Atlas
  `blackstation-dev`: `/health` y `/api/catalog` (catálogo demo, 4 categorías) responden; las rutas
  admin sin token dan 401.

**Desvíos y decisiones a revisar**
- `middlewares/validate` valida `params` antes que `body` (antes era al revés): un `:id` inválido da
  404 aunque el body también tenga errores, como el mock (que busca antes de validar).
- El `:id` mal formado se rechaza con un `transform` de zod que tira `AppError('NOT_FOUND')`
  (`idParams` en `validators/catalog`).
- La existencia de `categoriaId`/`extrasIds` la chequea el service, después de las reglas de
  formato: con varios errores a la vez, el mensaje puede diferir del mock (el mock chequea en orden de
  campo). Lo mismo con `Foto inválida.` por el par `fotoUrl`/`fotoPublicId`, que se evalúa después
  de los campos sueltos.
- Mensaje nuevo, sin equivalente en el mock: `Carpeta inválida.` para `folder` ≠ `products`.
- `POST` de producto ignora `activo` y `POST` de categoría ignora `activa` (no están en §8.2); el
  mock los aceptaba en el create de productos.
- Create, `PUT`, `DELETE` y `disponible` setean `createdAt`/`updatedAt` con `now()` (sin los
  timestamps automáticos de Mongoose), como el `PUT` de settings.
- La firma de subida está en `validators/catalog.ts` (`uploadSignatureBodySchema`), no en un
  validator propio.
- Si se cambia `CLOUDINARY_CLOUD_NAME`, los productos con fotos de la cuenta anterior no se pueden
  editar sin sacar o reemplazar la foto (el front reenvía la foto en cada `PUT` y no pasa
  `esFotoPropia`).
- **Sin verificar (manual del brief):** el panel `/admin/catalogo` con `VITE_USE_MOCKS=false`
  (crear, editar, baja, reactivar, agotado), la subida real de una foto y que la vieja desaparezca
  de la Media Library. Hacen falta login en el navegador y las credenciales de Cloudinary de
  `apps/api/.env`, que no leí.

### 2026-10-14 — Etapa 05b: auth y settings
- `MODELO_DATOS.md`: §7 (body del login, hash fijo, `expiresAt`, límite de 10 fallos por IP en
  15 min con 429 + `Retry-After`, `requireAdmin` sin consultar la base), §8.4 (tabla de reglas del
  `PUT`, `reputacion` ignorada hasta la Etapa 06, 500 sin documento), §6 (recorte de
  `public-settings`), §9 (comparación en tiempo constante) y §10 (`TOO_MANY_ATTEMPTS`, 429).
- `shared`: `TOO_MANY_ATTEMPTS` en `ERROR_CODES`/`ERROR_STATUS` (+ test).
- `apps/api`: `POST /api/auth/login`, `GET /api/public-settings`, `GET`/`PUT /api/admin/settings`.
  `services/auth` (bcrypt + JWT HS256 12 h con `iat` de `now()`), `lib/loginLimiter`,
  `middlewares/requireAdmin` (deja `res.locals.auth` tipado vía `Express.Locals`) y
  `requirePrintKey`, `mappers/settings`, `validators/{auth,settings}`, `services/settings`,
  controllers y routes (`/api/auth`, `/api` público, `/api/admin` con `requireAdmin` en todo el
  router).
- Tests de la api: 91 (+57) — login, límite (HTTP y unitario del limiter), `requireAdmin`,
  `requirePrintKey`, public/admin settings, cada regla del `PUT` con su mensaje exacto, `reputacion`
  preservada, `cupoMaxDefault` sin tocar franjas y 500 sin documento. typecheck, lint, test, `build`
  y `build:api` pasan.
- Probado contra Atlas `blackstation-dev` con `npm run dev:api`: `/health`, `public-settings`, login
  con el usuario del seed, `GET`/`PUT` de settings (válido e inválido) y preflight CORS desde
  `localhost:5173`.

**Desvíos y decisiones a revisar**
- `errorHandler`: un issue de zod con `code: 'custom'` se responde con su mensaje tal cual (sin
  `Datos inválidos. campo:`). Las reglas con mensaje para el usuario se escriben con
  `regla(check, mensaje)` de `validators/common.ts` (archivo no listado en el brief). Así el `PUT`
  devuelve los mismos mensajes que `validarSettings` de los mocks. Los errores genéricos de zod
  siguen con prefijo.
- `loginLimiter` expone también `barrer()` (lo usa el `setInterval`) y `createLoginLimiter()` para
  testearlo aislado; la app usa la instancia `loginLimiter`.
- Un 400 de validación en el login no cuenta como fallo para el límite.
- El `PUT` setea `updatedAt` con `now()` (con `timestamps: false` en esa update) para respetar el
  reloj de la API; los timestamps automáticos de Mongoose usan `new Date()`.
- Login sin body (`undefined`) responde 400 como body vacío.
- **Sin verificar en el navegador:** el login del panel y `/admin/ajustes` con `VITE_USE_MOCKS=false`.
  Se probaron los mismos endpoints y el preflight CORS por HTTP, no la UI.
- El `PUT` de prueba contra `blackstation-dev` guardó los mismos valores: solo cambió `updatedAt`.
- `prettier --check .` marca `seed/runSeed.ts` y `test/models.test.ts` (vienen de la 05a, fuera de
  este alcance). Se arreglan con `npm run format`.

### 2026-10-13 — Etapa 05a: base de la API
- `MODELO_DATOS.md`: colección `counters` (`orders:<fecha>`, `$inc` con upsert al final de la
  creación; un insert fallido saltea el número), `customers.nombreBusqueda` (interno, seteado en el
  service), `GET /health` con 503 `{ ok: false }` si Mongo no está conectado, `INTERNAL_ERROR`
  (500) en §10 y el pendiente de `numero` en §11 marcado resuelto.
- `shared`: `INTERNAL_ERROR` en `ERROR_CODES`/`ERROR_STATUS` (+ tests). `HealthResponse.ok` pasa a
  `boolean` para cubrir el 503.
- `apps/api` (`@blackstation/api`): Express 5 ESM, `createApp()` sin listen, env con zod,
  `AppError`, `clock.now()`, `normalizarBusqueda`/`escaparRegex`, `errorHandler`, `notFound`,
  `validate`, `/health`, cierre ordenado con SIGTERM/SIGINT. Modelos de las 9 colecciones con
  índices de §3, `nextNumero(fecha)` y seed idempotente (`--demo` con copias de los JSON de los
  mocks, mismos `_id`). tsup a `dist/` copiando `seed/data`.
- Raíz: `dev:api` y `build:api` (`build` sigue solo web). ESLint con globals de Node en `apps/api`.
- Front: `VITE_MOCK_FORCE_OPEN` → `VITE_FORCE_OPEN`; `jornadaForzada` se lee en los dos modos.
  Las entradas viejas de este registro conservan el nombre anterior.
- Tests de la api (34): env, errores, `/health` 200/503, índices únicos, `nextNumero` secuencial y
  en paralelo, texto y seed. typecheck, lint, test, `build` y `build:api` pasan.

**Desvíos y decisiones a revisar**
- Los tests de la api están en `apps/api/test/` (no en `src/`), con un `globalSetup` que levanta
  un solo mongodb-memory-server para todas las suites.
- `seed/data/settings.json` también se copió de los mocks: es la fuente de los defaults de §3.7 que
  usa el seed para crear `settings`.
- El seed valida solo sus variables (`MONGODB_URI` + `SEED_ADMIN_*`), no el env completo de la API.
- **Sin verificar:** `npm run dev:api` contra Atlas `blackstation-dev` (no hay `apps/api/.env` con
  la URI real) y la prueba manual de la web con mocks y `VITE_FORCE_OPEN=true` (el cambio es solo el
  nombre de la variable; typecheck y build pasan).
- Versiones: Express 5, Mongoose 9, zod 4, bcryptjs 3 (trae sus tipos, sin `@types/bcryptjs`).

### 2026-10-10 — Etapa 04e: productos más grandes en el ticket (cierre de Etapa 04)
- Pedido de la clienta en la Demo 2. `TICKET_TAMANOS` suma `alto` (doble alto, ancho normal: sigue
  en 48 columnas). `armarTicket`: ítems en `alto` + negrita; quitados y extras en `alto` sin
  negrita. Hora, número, nombre, aclaración y pie sin cambios. Tests nuevos de tamaños y de nombre
  largo.
- `ticket.css`: `alto` dobla la fuente en una caja de 200 % con `scaleX(0.5)`; mismo ancho por
  carácter que `normal`, corta en 48 columnas. `DESIGN_SYSTEM.md` §7 actualizado.
- Etapa 04 cerrada.

**Desvíos y decisiones a revisar**
- El print server (Etapa 07) tiene que mapear `alto` a `GS ! 0x01` (solo doble alto).

### 2026-09-30 — Etapa 04d: sonido de pedido nuevo más audible
- `hooks/useBeep`: el beep de 2 tonos senoidales pasa a 3 tonos ascendentes (784, 988 y 1319 Hz)
  en onda cuadrada, tocados 2 veces (1,48 s). Cada tono tiene envolvente lineal (ataque 8 ms,
  release 40 ms) y todo pasa por un `DynamicsCompressorNode` (umbral −12 dB, ratio 12) con ganancia
  de salida 1,4. Cada aviso arma su cadena y la desconecta al terminar el último tono.
- Se mantiene cuándo suena: una vez por polling, solo con pedidos nuevos, `bs-sonido` y el banner.
- Medido con `OfflineAudioContext` en Chrome headless: pico 0,92 (sin clipping), RMS −3,1 dBFS
  contra −23,5 dBFS del anterior (≈20 dB más), 1,48 s contra 0,29 s, y la envolvente nunca salta
  más del 15 % del pico en 1 ms (el anterior, 32 %). 3 pedidos en el mismo polling → un solo aviso
  (6 tonos); con el sonido apagado no suena. Sin errores de consola.

**Desvíos y decisiones**
- La programación del aviso quedó en `programarAviso(ctx, inicio)`, exportada y con
  `BaseAudioContext`, para poder renderizarla offline y medirla.
- Cuadrada y no diente de sierra: suena más "alarma" y corta mejor el ruido. Queda por confirmar
  en el carrito real (headless no reproduce audio: lo medido es la señal, no cómo se oye).

### 2026-09-30 — Etapa 04c: catálogo, franjas, clientes y ajustes (Demo 2)
- **Contrato antes que código (`MODELO_DATOS.md` §8.2):** `PUT products` y `PUT extras` aceptan
  `activo?` para reactivar (resuelve el pendiente de 04a; decidido con el usuario antes de
  empezar). `UpdateProductRequest`/`UpdateExtraRequest` en shared y el mock lo validan.
- `/admin/catalogo` (tabs Productos, Categorías y Extras en `?tab=`): `Table` con "Mostrar
  inactivos" (ocultos por defecto, atenuados con "Reactivar"). Productos agrupados por categoría
  con foto, precio, switch "Disponible" (PATCH directo), flechas ↑↓ y Drawer de alta/edición
  (categoría, precio, foto con preview/reemplazar/quitar, quitables como chips, extras con
  checkboxes). Categorías con switch "Activa"; extras con precio, máximo y "Disponible". Desactivar
  pide confirmación en un Modal; "Nuevo" en cada tab.
- `/admin/franjas`: fila por franja con barra `ocupados/cupoMax` (`--warning` al 80 %, `--danger`
  lleno), `Stepper` con mínimo = `ocupados` y PATCH con debounce de 500 ms, switch "Abierta".
  Pasadas atenuadas y sin edición, "Ya no se ofrece" dentro de la anticipación, "Fuera de horario"
  para las `huerfana`. Polling de 10 s.
- `/admin/clientes`: tabla por `ultimoPedidoAt` desc con contadores, badge de estado y candado si
  es manual. Búsqueda con debounce (mínimo 2 caracteres) en `?q=`, chips de filtro en el front y
  Drawer con contadores, `Select` de estado, switch "Estado manual" y wa.me. `?q=<teléfono>` desde
  la comanda abre la ficha sola.
- `/admin/ajustes`: formulario por secciones con barra sticky ("Guardar" solo con cambios,
  "Descartar"), aviso al salir con cambios (`useBlocker` + `beforeunload`), horarios con "Cierra al
  día siguiente", intervalo 10/15/20/30, `telefonoLocal` en dos campos con `normalizarTelefono`,
  plantillas con chips que insertan en el cursor y preview en vivo. Con cambios de horario o
  intervalo y pedidos activos: Modal "Hay N pedidos activos hoy…".
- Compartido del panel: `features/admin/hooks/useAdminSettings` (movido desde la comanda),
  `useToastError` y `components/ReputacionBadge` (lo usan la comanda y clientes). Genéricos:
  `hooks/useDebouncedValue`, `lib/telefono` (`formatearTelefono`) y `formatearJornada` en
  `lib/hora` (ahora `30/09` en vez de `30-09`). `Input`/`Textarea` aceptan `ref`. Íconos nuevos.
- Placeholders de `features/admin/pages/` borrados; el router apunta a cada feature.
- Probado con Chrome headless a 1280 y 768 px (58 chequeos, 3 corridas): todos los criterios del
  brief, sin scroll horizontal a 768 y sin errores de consola.

**Desvíos y decisiones**
- Un alta va al final de su categoría (`orden` = máximo + 1); cambiar de categoría también lo manda
  al final. Si dos vecinos tienen el mismo `orden` (datos viejos), las flechas renumeran la lista
  visible en vez de hacer 2 PUT.
- Categorías: el switch "Activa" hace de desactivar (con Modal) y reactivar (directo); no tienen
  botón aparte. Productos y extras: botón "Desactivar"/"Reactivar" por fila.
- Formularios cortos (categoría, extra) en `Modal`; el de producto en `Drawer`, como pide el brief.
- Franjas huérfanas: se muestran pero sin edición (no se ofrecen al cliente).
- `telefonoLocal` se muestra separado como característica de 3 dígitos (la del local, 336). Con
  otra de 2 o 4 dígitos se ve raro el corte, pero se guarda bien: `normalizarTelefono` arma lo mismo.
- El aviso de salida no bloquea si ya no hay sesión (vencimiento o 401), para no trabar el logout.
- Cambiar el estado de un cliente escribe la respuesta en todas las listas de `customerKeys` (la
  ficha y la tabla se actualizan sin esperar el refetch).
- En una de las corridas, el chequeo de `telefonoLocal` leyó el valor viejo después de guardar; no
  se volvió a reproducir en 3 corridas más. Queda anotado por si aparece en la API.

### 2026-09-30 — Etapa 04b: comanda, detalle del pedido y preview del ticket
- `features/admin/comanda/` (pages, components, hooks, CSS `adm-*`); `/admin` apunta ahí y se borró
  el placeholder de `features/admin/pages/ComandaPage.tsx`.
- Layout: 3 columnas desde lg (Pendientes / Confirmados / Finalizados, la última más angosta) y
  tabs con contador debajo de lg. Orden por columna según el brief; en Confirmados, una hora
  anterior a `abre` cuenta como madrugada (cruce de medianoche).
- Header: jornada, abierto/cerrado, switch "Tomar pedidos" (GET + PUT de settings, aviso "Pedidos
  pausados" en `--warning`) y toggle de sonido (`bs-sonido`).
- `useComanda`: carga completa, polling de 5 s con `?since=` y merge por `_id` (gana el `updatedAt`
  más nuevo), `refetchIntervalInBackground`, resync completo cada 5 min, al volver después de 1 min
  (pestaña oculta o ventana sin foco) y al cambiar la jornada (otra key). Banner "Sin conexión,
  reintentando… (última actualización HH:mm)" sin perder los datos.
- Pedido nuevo: pulso con borde `--accent` hasta tocar la card o 30 s, "(N) Comanda" en la pestaña y
  beep de 2 tonos con Web Audio, una vez por polling. Banner "Tocá para activar el sonido" si el
  audio está bloqueado. Toasts "#N venció" / "#N lo canceló el cliente".
- Card y detalle (Drawer derecho) con las acciones del brief: Confirmar/Entregar de un toque
  (bloqueados en card y detalle mientras viaja cualquier acción del pedido, por `mutationKey`),
  countdown (`--warning` < 5 min, `--danger` < 2 min), "Extender plazo" con toast, wa.me con las
  plantillas de `settings.mensajes`, Reimprimir, Cancelar con Modal de motivo (`no_retiro` solo en
  confirmado), cliente con contadores, reputación y link a `/admin/clientes?q=<teléfono>`. 409
  `INVALID_TRANSITION` → toast y refetch.
- `components/Ticket.tsx` + `ticket.css`: mapea `armarTicket` a estilos (72 mm, mono, blanco y negro).
- Genéricos: `hooks/useBeep`, `hooks/useDocumentTitle`, `lib/hora` (`HH:mm` en la zona del negocio).
  `Countdown` suma `avisoMs`/`urgenteMs`; `Badge` pasa atributos (`data-*`); íconos nuevos.
- Probado con Chrome headless a 1280 y 768 px (55 chequeos + audio y simulador): todos los criterios
  de aceptación del brief. Sin errores de consola.

**Desvíos y decisiones**
- **Bug corregido en `Modal` (04a):** en StrictMode, el `close()` del primer cleanup despacha un
  `close` que recibía el segundo montaje y cerraba el modal apenas se abría. Ahora se ignora si el
  diálogo ya está abierto.
- **Mocks sin red:** `latency()` falla con `NETWORK_ERROR` si `navigator.onLine` es `false`, para
  poder probar el banner con mocks (anotado en `CLAUDE.md`). La query de la comanda usa
  `networkMode: 'always'`: si no, TanStack la pausa offline sin error y el banner no sale.
- **Jornada del panel:** se calcula en el front con `getJornada(settings)`. Para que con
  `VITE_MOCK_FORCE_OPEN` coincida con la del mock, `services` exporta `jornadaForzada` (siempre
  `false` con la API real). La comanda pide `?fecha=` explícita.
- El merge de `?since=` se hace dentro del `queryFn` (lee el cache y devuelve la versión mergeada);
  las mutaciones sí guardan su respuesta con `setQueryData`. La detección de nuevos/cancelaciones
  se suscribe al query cache (no a renders).
- Un "nuevo" que llega ya finalizado, o que termina antes de que lo toquen, deja de pulsar y de
  contar en el título.
- Confirmar y Entregar también están en el footer del detalle; "Reimprimir" y los wa.me van en el
  cuerpo.
- `useAdminSettings` quedó en `comanda/hooks`; 04c (Ajustes) puede moverlo a `features/admin/hooks`.
- Los chequeos de sonido se hicieron contando osciladores (headless no reproduce audio) y el audio
  bloqueado se emuló suspendiendo el `AudioContext`: headless no aplica la política de autoplay.

### 2026-09-29 — Etapa 04a: base del panel
- `MODELO_DATOS.md` (antes que el código): `PATCH /api/admin/orders/:id/extender` (§8.1) y mención
  en §5.4; code `NOT_EXTENDABLE` (409, §10); `GET /api/admin/customers?q=` reemplaza `telefono`
  (§8.5); `huerfana` en `GET /api/admin/slots` (§8.3).
- `@blackstation/shared`: `NOT_EXTENDABLE` en `ERROR_CODES`/`ERROR_STATUS`, `huerfana` en
  `AdminSlot`, `q` en `AdminCustomersQuery`, `ExtendOrderResponse`. `utils/ticket.ts` con
  `armarTicket(order)` (líneas `{ texto, tamano, negrita, alineacion }`, `TICKET_TAMANOS`,
  `TICKET_ALINEACIONES`, `TICKET_COLUMNAS = 48`) y `getFranjasDeFecha` en `jornada.ts`. 67 tests (+12).
- Services admin completos en `api/` y `mocks/` (misma firma): pedidos (+ `extendOrder`), catálogo
  CRUD, `uploadProductPhoto`, franjas, settings y clientes. Query keys nuevas: `catalogKeys.admin/
  categories/products/extras`, `slotKeys.admin`, `settingsKeys.admin`, `orderKeys.pendientes`,
  `customerKeys`.
- Mocks reorganizados: `mocks/common.ts` (reglas compartidas), `mocks/admin.ts`,
  `mocks/simulador.ts`. Upsert de customer al crear pedido, `entregados++` / `noShows++`, ack de
  impresión simulado a los 3 s (también tras reprint), `extender`, `CUPO_BELOW_OCUPADOS`,
  `huerfana`, validaciones básicas del catálogo y settings, 401 sin token. Store sincronizado entre
  pestañas con el evento `storage`. Simulador con `VITE_MOCK_SIMULAR=true`.
- `AdminLayout`: sidebar con isotipo, íconos y badge de pendientes (polling de 10 s); solo íconos
  debajo de lg. Skeleton mientras carga la ruta lazy. Timer de vencimiento de sesión con toast
  "Tu sesión venció" (y chequeo al volver a la pestaña).
- Login movido a `features/admin/login/`: logo completo, mostrar contraseña, 401 inline, error de
  red → toast, `?next=` (solo rutas `/admin`), logueado → `/admin`. `RequireAuth` y el handler de
  401 de `main.tsx` mandan `?next=`.
- Componentes nuevos con su CSS: `Switch`, `Select`, `Modal` (`<dialog>` + `showModal`), `Table`,
  `EmptyState`, `ErrorState`. Íconos nuevos del panel en `Icon`.
- Docs: `DESIGN_SYSTEM.md` §7 (el ticket sale de `armarTicket`) y §9 (Modal, Table); `CLAUDE.md`
  (`bs-sonido`, `VITE_MOCK_SIMULAR`, hooks genéricos reales, sync del store); `.env.example`.
- Probado con Chrome headless (42 chequeos): login (401 inline, `?next=`, token vencido, timer de
  sesión, logueado → `/admin`), pedido en la pestaña pública visto por `?since=` en la del panel,
  contadores del customer, búsqueda "juan"/"Juán"/dígitos, extender (sube, `NOT_EXTENDABLE`,
  `INVALID_TRANSITION` en confirmado y vencido), confirmar → ack a los 3 s, reprint, entregar,
  `no_retiro`, franjas (cupo < ocupados, cerrada no se ofrece), catálogo (alta, agotado y baja
  reflejados en el público), settings (423 con pedidos pausados, 400 inválido), foto a 400 px
  JPEG, 401 sin token, Modal (foco, Esc). Layout a 1280 y 768 px. Sin errores de consola.

**Desvíos y decisiones**
- **Falta en el contrato: reactivar productos y extras.** §8.2 no incluye `activo` en `PUT
  products`/`PUT extras` (las categorías sí tienen `activa`), y 04c pide "Reactivar". Hay que
  sumarlo a `MODELO_DATOS.md` antes de 04c; no se improvisó.
- `serverTime` del mock sale 2 s atrasado: un pedido de otra pestaña llega por `storage` un instante
  después de su `updatedAt` y sin margen se perdería. El panel mergea por `_id`, así que repetir no
  molesta. Anotarlo para la API (tomar `serverTime` antes de la query).
- `q` con menos de 2 caracteres → 400 `VALIDATION_ERROR` (anotado en §8.5).
- Con `VITE_MOCK_FORCE_OPEN` la secuencia de franjas arranca en "ahora", así que solo se marca
  `huerfana` un documento cuya hora no cae en el intervalo; si no, las franjas pasadas saldrían
  huérfanas.
- `getFranjasDeFecha` (shared) no estaba en el brief: `GET /admin/slots?fecha=` de otra jornada la
  necesita, y la API también.
- "Algunos de transferencia se dejan vencer": el simulador no confirma nada, así que los de
  transferencia que nadie confirma vencen solos a los `minutosTransferencia`.
- Badge de pendientes: query propia (`orderKeys.pendientes`, `estado=pendiente`) en vez de leer la
  comanda, así funciona en cualquier pantalla del panel.
- `armarTicket` cambia el espacio duro de `Intl` por uno común (las térmicas no lo traen) y usa
  separadores de 48 columnas. Los caracteres `×` y tildes quedan para el codepage del print server.
- `uploadProductPhoto` real: un error de Cloudinary sale como `ApiError` con code `UPLOAD_ERROR`
  (del front, como `NETWORK_ERROR`).
- Pantallas del panel siguen como placeholders en `features/admin/pages/` (04b y 04c).

### 2026-09-29 — Etapa 03 cerrada (Demo 1)
- Demo 1 publicada en Vercel con mocks: https://black-station-web.vercel.app/
- La clienta aprobó el diseño.
- `apps/web/vercel.json` ya tenía el rewrite de SPA (`/(.*)` → `/index.html`): `/checkout` y
  `/pedido/:codigo` cargan bien al recargar. Sin cambios.
- `DESIGN_SYSTEM.md` §10: se aclara que el rótulo del header (isotipo + "BLACK STATION" en texto)
  sí es HTML; lo que no se recrea con texto es el logo completo en arco.

### 2026-09-28 — Etapa 03c: repaso antes de enviar + cancelación por el cliente
- `MODELO_DATOS.md`: motivo `cliente` (§3.4), transición `pendiente` → `cancelado`/`cliente` por el
  Cliente (§4, libera cupo y no toca `customers`) y `POST /api/orders/:codigo/cancelar` (§6). Sin
  codes nuevos en §10.
- `@blackstation/shared`: `cliente` en `MOTIVOS_CANCELACION`, actor `cliente` en
  `ACTORES_TRANSICION` y la transición en `TRANSICIONES` (7). 57 tests (+2).
- Services: `cancelOrder(codigo)` en `api/` y `mocks/`. El mock primero vence lo vencido (como el
  job), valida con `puedeTransicionar`, libera el cupo y responde 404 `ORDER_NOT_FOUND` / 409
  `INVALID_TRANSITION`. `liberarCupo` y `toPublicOrder` quedan compartidos con el vencimiento y el
  `GET`.
- Checkout: "Confirmar pedido" valida y abre `RepasoSheet` ("¿Hacemos el pedido?", hora, total y
  texto por método de pago). "Sí, hacer pedido" revalida, lleva spinner y no se puede cerrar el
  sheet mientras viaja el POST. Un error cierra el sheet y aplica la tabla de la Etapa 03.
- Seguimiento: botón "Cancelar pedido" solo en `pendiente`, `CancelarSheet` con aviso y `wa.me`,
  hook `useCancelOrder`. Estado `cancelado`/`cliente`: "Cancelaste tu pedido." + "Hacer un nuevo
  pedido".
- `Button` suma la variante `danger` (`.btn--danger`, con `--danger`).
- Probado con Chrome headless a 375 px (30 chequeos): formulario inválido sin sheet, textos por
  método, "Volver" sin pedido, 409 `SLOT_FULL` con el sheet abierto (se cierra, error inline y foco
  en horario), cancelación con cupo liberado y la franja de vuelta en el checkout, banner y
  `bs-pedido-activo` borrados, 409 por confirmación en el medio (toast + estado actualizado), sin
  botón en `confirmado`/`entregado`/`cancelado`. Sin errores de consola.

**Desvíos y decisiones**
- **Actor `cliente` en `ACTORES_TRANSICION`:** el brief pide la transición en `transitions.ts`, y la
  tabla necesita un actor. §4 ya dice "Quién: Cliente".
- `useCancelOrder` además invalida `slotKeys.all` (se liberó un cupo) y guarda la respuesta con
  `setQueryData` para mostrar el estado final sin esperar el refetch.
- Toast del 409: el texto del brief ("Tu pedido ya fue confirmado…") sale solo si el refetch trae
  `confirmado`. Si el pedido venció en el medio sale "Tu pedido ya no se puede cancelar." y la
  pantalla muestra el estado de vencido. Otros errores del cancel: toast genérico con el sheet
  abierto para reintentar.
- Si la franja elegida desaparece con el repaso abierto (polling de slots), el sheet se cierra y
  queda el aviso de franja perdida del formulario.
- Si `public-settings` todavía no cargó, el texto de transferencia dice "unos minutos" en vez del
  número.

### 2026-09-28 — Etapa 03: app pública
- Componentes base en `components/`, cada uno con su CSS en `@layer components`: `Button` (`.btn`),
  `Field` / `Input` / `Textarea`, `Chip`, `Stepper`, `Card`, `Drawer` (`bottom`: sheet en mobile y
  modal en md; `right`), `Badge`, `Countdown`, `Toast` (`ToastProvider` + `useToast`), `Skeleton`,
  más `Icon`. Hooks genéricos `useAhora` y `useCountdown`. `lib/`: `waLink`, `renderPlantilla` +
  `mensajeComprobante`, y helpers de `localStorage`.
- `features/public` reorganizado en `catalogo/`, `carrito/`, `checkout/` y `pedido/`. Los hooks que
  usan varias sub-features quedan en `features/public/hooks`.
- Catálogo, detalle de producto (`?producto=<id>`, `&linea=<n>` en edición), carrito (Context +
  `useReducer`, fusión de líneas, revalidación contra el catálogo), checkout con la tabla de errores
  por `code` y seguimiento con polling, countdown y `wa.me`. Keys nuevas `bs-cliente` y
  `bs-pedido-activo`, documentadas en `CLAUDE.md`.
- `@blackstation/shared`: la lógica de jornada del mock pasa a `utils/jornada.ts` (`getJornada`, más
  `getProximaApertura` para el header), con `ahora` como parámetro. `ESTADOS_FINALES` +
  `esEstadoFinal`. 55 tests (+12).
- Mocks: fixture de `customers` (`5493361111111` bloqueado, `5493362222222` requiere
  transferencia), store en versión 2. `POST /orders` valida el paso 2 de §5.3 (403
  `CUSTOMER_BLOCKED` / `TRANSFER_REQUIRED`). `GET /orders/:codigo` y `GET /slots` vencen los
  `pendiente` con `expiresAt ≤ now` y liberan el cupo. `orderKeys.detail` pasa a `orderKeys.public`.
- Probado con Chrome headless a 375 px: pedido completo, fusión y edición, el botón atrás cierra el
  sheet, persistencia tras recargar, un agotado bloquea "Continuar", 409 inline, bloqueado,
  transferencia forzada, cerrado con `VITE_MOCK_FORCE_OPEN=false`, vencimiento con cupo liberado,
  banner de pedido en curso y texto de `wa.me`. Sin errores de consola.

**Desvíos y decisiones**
- **Deploy en Vercel pendiente:** no se hizo desde esta sesión, así que falta la URL de la Demo 1.
- **Bug corregido en `main.tsx`:** `styles/index.css` se importaba después del router, así que
  `@layer components` quedaba declarada antes que `reset`/`base` y perdía contra ellas (los `<a>`
  con `.btn` salían naranja sobre naranja). Ahora es el primer import; se agregó a
  `DESIGN_SYSTEM.md` §1.
- Header con isotipo + "BLACK STATION" en texto, como pide el brief. `DESIGN_SYSTEM.md` §10 dice que
  el logo no se recrea con texto: se interpretó que eso aplica al logo completo en arco, no a este
  rótulo. Confirmar.
- Tocar la card (no solo el "+") también abre el detalle.
- Los toasts van arriba de la pantalla: abajo tapaban los CTA de los footers sticky.
- Al revalidar, un extra que se ajusta a `cantidadMax` no genera nota (el brief solo pide nota al
  sacar). Si el catálogo anterior no está en memoria (página recién cargada), la nota dice "un extra"
  porque el carrito no guarda nombres.
- La edición de línea va por índice (`&linea=<n>`): si la URL quedó vieja después de cambiar el
  carrito, el sheet abre en modo agregar. Si `?producto=` apunta a un producto agotado o inexistente,
  el sheet no se abre.
- En el mock, el paso 2 (customer) se chequea antes de validar el formato del teléfono (paso 4),
  siguiendo el orden de §5.3.
- `playwright-core` se usó solo desde un directorio temporal para las pruebas; no se agregó al repo.

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
