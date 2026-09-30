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
| 04 | Panel: login, comanda, catálogo, franjas, clientes y ajustes (+ services/mocks admin) | ✅ Lista para la Demo 2 (04a, 04b y 04c cerradas) |
| 05 | API (`apps/api`): Express por capas, MongoDB, auth y job de vencimiento | Pendiente |
| 06 | Reglas de reputación de clientes | Pendiente |
| 07 | Print server (`apps/print-server`): ESC/POS + PM2 | Pendiente |
| 08 | Pulido y salida a producción (marca definitiva, settings reales) | Pendiente |

## Documentos

- [MODELO_DATOS.md](MODELO_DATOS.md) — fuente de verdad del modelo de datos, estados,
  reglas de negocio y endpoints.
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — arquitectura CSS, tokens y reglas de estilos.

## Cómo correr la Demo 2 (con mocks)

1. `apps/web/.env`: `VITE_USE_MOCKS=true`, `VITE_MOCK_SIMULAR=true` y, para probar de día,
   `VITE_MOCK_FORCE_OPEN=true` (con `false` se respetan los horarios reales: martes a domingo
   20:00–00:30).
2. `npm run dev` desde la raíz.
3. Dos pestañas del mismo navegador (comparten el store `bs-mock-db`):
   - Pública: `http://localhost:5173/` (catálogo, checkout, seguimiento).
   - Panel: `http://localhost:5173/admin`, usuario `admin`, contraseña `admin`.
4. Con el panel abierto, el simulador crea un pedido cada 30–60 s; los de la pestaña pública
   aparecen en la comanda en ≤ 5 s. Para arrancar de cero: borrar `bs-mock-db` del `localStorage`.

En Vercel las mismas variables van en el dashboard.

## Registro de cambios

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
