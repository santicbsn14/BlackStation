# Brief 04a — Base del panel: modelo, shared, services/mocks admin, layout, login y componentes

## Objetivo
Dejar la base de la Etapa 04: cambios de modelo, services y mocks admin completos, layout del
panel, login pulido y los componentes base nuevos. Las pantallas (comanda, catálogo, franjas,
clientes, ajustes) van en 04b y 04c.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md, docs/DESIGN_SYSTEM.md, docs/ESTADO.md.

## Alcance

### 1. docs/MODELO_DATOS.md (primero, antes de tocar código)
- §8.1: `PATCH /api/admin/orders/:id/extender` (sin body). `expiresAt = max(expiresAt, now) +
  minutosTransferencia`. Atómico con condición `{ estado: 'pendiente', expiresAt: { $ne: null } }`.
  Sin límite de extensiones. Errores: 404 `ORDER_NOT_FOUND`, 409 `INVALID_TRANSITION` (no está
  pendiente), 409 `NOT_EXTENDABLE` (sin `expiresAt`). Responde la order actualizada.
- §5.4: mencionar que el panel puede extender el plazo.
- §10: code `NOT_EXTENDABLE` (409).
- §8.5: `GET /api/admin/customers?q=` reemplaza `telefono`. `q` solo dígitos → `telefono`
  contiene `q`; si no → `nombre` contiene `q`, sin distinguir mayúsculas ni tildes. Mínimo 2
  caracteres; tope 50 resultados; orden `ultimoPedidoAt` desc. Sin `q`: los 50 más recientes.
- §8.3: `GET /api/admin/slots` devuelve la unión de las franjas posibles y los documentos de
  `pickupSlots` de esa fecha. Los que no están en la secuencia vienen con `huerfana: true`
  (se ven en el panel, no se ofrecen al cliente).

### 2. @blackstation/shared
- `NOT_EXTENDABLE` en `ERROR_CODES` y `ERROR_STATUS`.
- `huerfana` en el tipo del slot admin. `q` en el query de customers.
- `utils/ticket.ts`: `armarTicket(order)` → array de líneas `{ texto, tamano, negrita, alineacion }`
  (valores `as const`). Ticket solo para cocina, de arriba hacia abajo: `horaRetiro` gigante,
  `#numero` grande, nombre, ítems (`2× Lomito completo`, debajo `SIN cebolla` y `+ Cheddar ×2`),
  aclaración, y al pie el total más `PAGADO` (transferencia) o `COBRAR $X` (retiro). Sin precios
  por ítem. Con tests. Esta función la usa la preview HTML (04b) y el print server (Etapa 07).

### 3. Services admin (`api/` y `mocks/`, misma firma) + query keys
Todos los endpoints de §8 más `extender`. Foto: `uploadProductPhoto(file) → { fotoUrl, fotoPublicId }`.
- `api/`: pide firma a `/admin/uploads/signature` y sube a Cloudinary.
- `mocks/`: achica con canvas a 400 px JPEG y devuelve un data URL + un `fotoPublicId` falso.
  No llama a Cloudinary.
Factories nuevas en `queryKeys.ts` por dominio admin.

### 4. Mocks
- Rutas admin: sin token o con token vencido → 401 `UNAUTHORIZED`.
- `createOrder`: upsert de customer según §3.6 (pendiente desde la Etapa 02).
- Pasar a `entregado` → `entregados++`. Cancelar con `no_retiro` → `noShows++`.
- Toda mutación actualiza `updatedAt`, incluidos el vencimiento y la cancelación del cliente.
- `GET /admin/orders` vence los pendientes antes de responder (igual que `GET /orders/:codigo`)
  y respeta `since` y `serverTime`.
- Al confirmar, simular el `ack` de impresión: 3 s después setear `impresoAt` y `updatedAt`.
- Reprint → `impresoAt = null` (409 `NOT_CONFIRMED` si no está `confirmado`); se vuelve a
  simular el ack.
- `PATCH /admin/slots` valida `CUPO_BELOW_OCUPADOS`. `GET /admin/slots` con `huerfana`.
- Catálogo: CRUD con borrado soft y `PATCH disponible`, validaciones básicas (`VALIDATION_ERROR`).
- `PUT /admin/settings`: validación básica. Settings, franjas y el catálogo público reflejan
  los cambios.
- **Sincronizar el store entre pestañas** con el evento `storage`: un pedido hecho en la app
  pública en una pestaña aparece en la comanda abierta en otra.
- **Simulador** con `VITE_MOCK_SIMULAR=true`: un pedido aleatorio cada 30–60 s, por la misma
  lógica de `createOrder`, con franjas reales, ítems con quitados y extras, y mezcla de métodos
  de pago. Algunos de transferencia se dejan vencer. Solo corre con mocks y con el panel abierto.

### 5. Layout del panel (`AdminLayout`)
- Sidebar con isotipo y links Comanda (badge con la cantidad de pendientes), Catálogo, Franjas,
  Clientes y Ajustes. "Salir" al final. En md, solo íconos.
- Mientras carga cada ruta lazy: Skeleton.

### 6. Login
- `logo.svg` completo, usuario y contraseña, con botón para mostrar la contraseña.
- 401 `INVALID_CREDENTIALS` → error inline "Usuario o contraseña incorrectos". Error de red → toast.
- Guardar `bs-token` con `expiresAt`. Al cargar, si el token está vencido: borrarlo e ir al login.
  Timer que cierra la sesión al vencer, con el toast "Tu sesión venció".
- Redirigir a `?next=` o a `/admin`. Si ya está logueado y entra a `/admin/login` → `/admin`.

### 7. Componentes nuevos en `components/`, cada uno con su CSS
- `Switch`.
- `Select`.
- `Modal` sobre `<dialog>` nativo (`showModal`: foco, Esc, backdrop). Para confirmaciones y
  formularios cortos. El `Drawer` queda para los paneles de detalle.
- `Table`, con fila clickeable y fila atenuada para inactivos.
- `EmptyState` y `ErrorState` (este último con botón "Reintentar").
- El `Ticket` va en 04b.

## No incluye
Pantallas de comanda, catálogo, franjas, clientes y ajustes (04b y 04c). La API real (Etapa 05).
Reglas de reputación (Etapa 06).

## Archivos
- `docs/MODELO_DATOS.md`, `docs/DESIGN_SYSTEM.md` (§9: Modal sobre `<dialog>`; §7: el ticket sale
  de `armarTicket`), `CLAUDE.md` (keys `bs-sonido`; `bs-cliente` y `bs-pedido-activo` si faltan;
  variable `VITE_MOCK_SIMULAR`; hooks genéricos reales en lugar de `usePolling`).
- `packages/shared`: errors, types, `utils/ticket.ts` + tests.
- `apps/web/src/services/**`, `app/layouts/AdminLayout`, `features/admin/login/**`, `components/**`.
- `apps/web/.env.example`.

## Criterios de aceptación
- MODELO_DATOS refleja los 4 cambios antes que el código.
- `armarTicket` con tests, incluidos: pago retiro vs transferencia, quitados y extras, y aclaración.
- Pedido creado en la pestaña pública → aparece en `GET /admin/orders?since=` en la otra pestaña.
- Crear pedido suma `pedidosTotal`. Entregar suma `entregados`. `no_retiro` suma `noShows`.
- `extender`: sube `expiresAt`, 409 `NOT_EXTENDABLE` en retiro, y 409 si ya venció o no está
  pendiente.
- Login: 401 inline, token vencido → login, `?next=` respetado.
- typecheck, lint, test y build pasan.

## Al terminar
Actualizar docs/ESTADO.md.