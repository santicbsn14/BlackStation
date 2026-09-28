# Brief — Etapa 03: App pública

## Objetivo

Construir las pantallas públicas (catálogo, detalle de producto, carrito, checkout y seguimiento)
sobre los mocks, con sus componentes base, listas para la **Demo 1** en Vercel.

## Docs a leer

- `CLAUDE.md`
- `docs/MODELO_DATOS.md`: §1, §3.2–3.4, §3.7, §5.1–5.5, §6 y §10.
- `docs/DESIGN_SYSTEM.md`
- `docs/ESTADO.md`: desvíos de las Etapas 02 y 02b.

## Alcance

### Sí

#### Componentes base (`components/`)

`btn`, `field` / `input` / `textarea`, `chip`, `stepper`, `card`, `drawer` (variantes `bottom` y
`right`), `badge`, `countdown`, `toast` (provider + hook), `skeleton`.
Cada uno con su CSS al lado, en `@layer components`.

#### Catálogo (`/`)

- **Header sticky:** isotipo + "BLACK STATION" a la izquierda; botón de carrito con contador de
  unidades a la derecha (abre el drawer).
- **Franja de estado del local**, debajo del header:
  - Abierto: "Abierto · retiros desde HH:mm", con la hora de la primera franja de `GET /slots`.
  - Cerrado: "Cerrado · abrimos hoy a las HH:mm" o "…el martes a las HH:mm", según `horarios`.
  - `pedidosHabilitados = false`: "Hoy no estamos tomando pedidos".
- **Banner de pedido en curso:** si hay un pedido activo en `bs-pedido-activo` que no está en un
  estado final, se muestra "Tenés un pedido en curso · #N · Ver", que lleva a `/pedido/:codigo`.
- **Página única:** una sección por categoría.
- **Chips de categorías:** sticky, con scroll horizontal. Al tocar uno, scroll a su sección.
  El chip activo lo marca un scroll-spy con IntersectionObserver.
- **Card en formato fila:**
  - A la izquierda: nombre, descripción recortada a 2 líneas y precio.
  - A la derecha: miniatura cuadrada con un botón "+".
  - En `md` o más, 2 columnas dentro de `l-container`.
- **Botón "+":**
  - Agrega directo si el producto no tiene quitables ni extras (con toast).
  - Si tiene alguno de los dos, abre el detalle.
- **Agotado:** mantiene su posición; se ve atenuado, con badge "Agotado", sin "+" y no se puede
  tocar.
- **Sin foto:** placeholder en `--surface-2` con el isotipo al 15%.
- **Estados:**
  - Cargando: skeleton de 3 filas por sección.
  - Error: mensaje + "Reintentar".
  - Vacío: "Todavía no hay productos cargados".
- El carrito se puede armar aunque el local esté cerrado.

#### Detalle de producto

- **Formato:** bottom sheet en mobile; modal centrado en `md` o más.
- **Historial:** al abrir se agrega `?producto=<id>`, para que el botón atrás lo cierre.
- **Cabecera:**
  - Foto 16:9, solo si hay; sin foto no se muestra placeholder.
  - Nombre, descripción completa y precio base.
- **"¿Le sacamos algo?"** (solo si hay `ingredientesQuitables`): un chip por ingrediente. Al
  activarlo muestra "Sin X", tachado y con borde `--accent`.
- **"Agregale"** (solo si hay extras): una fila por extra con nombre y "+$precio".
  - `cantidadMax = 1`: la fila funciona como toggle.
  - `cantidadMax > 1`: stepper de 0 a `cantidadMax`.
- **Footer sticky:**
  - Stepper de cantidad, con mínimo 1.
  - Botón "Agregar · $X", con el precio calculado en vivo con `calcularSubtotal` de `shared`.
- **No lleva aclaración:** es un campo del pedido, va en el checkout.
- **Al agregar:**
  - Se cierra el sheet y sale el toast "Agregado al carrito".
  - El contador del header hace un pulso, salvo con `prefers-reduced-motion`.
- **Modo edición:** se abre desde el carrito con los valores precargados; el botón dice
  "Guardar cambios".
- **Fusión de líneas:** mismo producto + mismos quitados + mismos extras → se suma la cantidad.
  Vale también cuando una edición deja la línea igual a otra.

#### Carrito (drawer `right`)

- Pantalla completa en mobile; unos 400px en `md` o más. Título: "Tu pedido".
- **Cada línea:**
  - Nombre, cantidad y subtotal.
  - Debajo, en `--text-muted`: los quitados ("Sin cebolla, sin pepinillo") y los extras
    ("+ Extra cheddar ×2").
  - Stepper: en 1, el "−" pasa a ser un tacho que borra la línea.
  - Botón "Editar".
- **Footer sticky:** total + "Continuar", que lleva a `/checkout`.
- **Vacío:** "Tu pedido está vacío" + "Ver el menú".
- **Revalidación contra el catálogo:** se hace un refetch del catálogo al abrir el drawer y al
  entrar al checkout.
  - Producto inactivo, de categoría inactiva, que ya no está o agotado: la línea se ve atenuada
    con "Ya no está disponible" y no suma al total.
  - Extra que ya no se ofrece o quitado inválido: se saca de la línea y se muestra una nota
    ("Se quitó X (no disponible)").
  - Extra con cantidad por encima de `cantidadMax`: se ajusta al máximo.
  - Precios: siempre se toman del catálogo, sin aviso de cambio.
- **Con líneas no disponibles**, "Continuar" queda bloqueado. Se muestra el aviso "Hay productos
  que ya no están disponibles" y un botón "Quitarlos".

#### Checkout (`/checkout`)

- **Sale el botón de prueba de la Etapa 02.**
- **Al entrar:**
  - Carrito vacío: "No hay nada en tu pedido" + "Ver el menú".
  - Líneas no disponibles: vuelve a `/` con el drawer abierto y el aviso.
- **Secciones, en una columna:**
  1. **Resumen colapsable** ("N productos · $total"): muestra las líneas en modo lectura.
  2. **Tus datos:**
     - Nombre.
     - Celular en dos campos: característica (precargada `336`) y número, con la ayuda
       "Sin 0 ni 15".
     - Se normaliza con `normalizarTelefono` y se valida al salir del campo.
     - Nombre y teléfono se guardan en `bs-cliente` y se precargan la próxima vez.
  3. **Horario de retiro:**
     - Grilla de chips con la hora; si `disponibles ≤ 2`, suman "quedan N".
     - `GET /slots` se refresca cada 60 s.
     - Si la franja elegida desaparece, se deselecciona y se avisa en la sección.
  4. **Pago:** radio cards, con **transferencia preseleccionada**.
     - Transferencia: "Tenés {minutosTransferencia} min para mandar el comprobante".
     - Pago al retirar.
  5. **Aclaración:** textarea opcional con contador `0/140`.
- **Footer sticky:**
  - Total + "Confirmar pedido", con spinner y bloqueo contra doble envío.
  - Respuesta 201:
    - Se vacía el carrito.
    - Se guarda el `codigo` en `bs-pedido-activo`.
    - Se navega con `replace` a `/pedido/:codigo`.
- **Estados:**
  - `abierto = false`: se reemplaza el formulario por el aviso de cerrado. Usa el mismo texto que
    el header y el carrito se conserva.
  - `abierto = true` con `slots: []`: "No quedan horarios disponibles para hoy".
  - Cargando: skeleton en horario y pago.
- **Errores del POST, por `code`:**

| Code | UI |
|---|---|
| `SLOT_FULL`, `SLOT_CLOSED`, `SLOT_TOO_SOON`, `INVALID_SLOT` | Refetch de slots, deselecciona la franja, error inline en la sección horario y scroll hasta ahí. |
| `PRODUCT_UNAVAILABLE`, `EXTRA_UNAVAILABLE`, `INVALID_REMOVED`, `INVALID_EXTRA_QUANTITY` | Refetch del catálogo; vuelve a `/` con el drawer abierto y el aviso. |
| `INVALID_NOMBRE`, `INVALID_TELEFONO`, `INVALID_ACLARACION` | Error inline en el campo. |
| `TRANSFER_REQUIRED` | Selecciona transferencia, deshabilita "al retirar" y muestra "Para este número el pago es por transferencia". |
| `CUSTOMER_BLOCKED` | "No podemos tomar tu pedido online. Escribinos por WhatsApp" + botón `wa.me/<telefonoLocal>`. |
| `ORDERS_DISABLED`, `CLOSED` | Pasa al estado de cerrado. |
| Otro, `HTTP_ERROR`, `NETWORK_ERROR` | Toast "No pudimos enviar tu pedido. Probá de nuevo." |

#### Seguimiento (`/pedido/:codigo`)

- **Polling** a `GET /orders/:codigo` cada 10 s.
  - Se corta en `entregado` o `cancelado`, y en ese momento se borra `bs-pedido-activo`.
  - Si falla un refetch, se mantiene lo último que se mostró y aparece
    "Sin conexión, reintentando…".
- **Cabecera:** badge de estado, "Pedido #N" en grande y "Retirás a las HH:mm" en display
  condensado con `u-tabular`.
- **Bloque según estado:**

| Estado | Contenido |
|---|---|
| `pendiente` + transferencia | 3 pasos (Transferí → Mandá el comprobante → Te confirmamos). Alias, CBU, titular y total, cada uno con "Copiar" (toast). Countdown a `expiresAt` ("Te quedan mm:ss", en `--danger` el último minuto; al llegar a 0: "Se venció el plazo"). Botón primario "Enviar comprobante". |
| `pendiente` + retiro | "Recibimos tu pedido. Te confirmamos por WhatsApp." |
| `confirmado` | "¡Confirmado! Te esperamos a las HH:mm." |
| `entregado` | "¡Gracias! Pedido entregado." |
| `cancelado` · `vencido` | "Se canceló porque no recibimos el comprobante a tiempo." + "Hacer un nuevo pedido". |
| `cancelado` · `manual` / `no_retiro` | "Tu pedido fue cancelado. Cualquier duda, escribinos." + `wa.me` al local. |

- **"Enviar comprobante"** abre `wa.me/<telefonoLocal>` con el texto:
  `Hola! Te mando el comprobante del pedido #{numero} a nombre de {nombre} ({total}).`
  Va en una plantilla en `lib/`.
- **Detalle en modo lectura:** ítems con quitados y extras, aclaración y total.
- **404:** "No encontramos ese pedido" + "Ver el menú".
- **Cargando:** skeleton.

#### Mocks

- **Fixture de `customers`** (subir la versión de `bs-mock-db` para forzar el reseed):
  - `5493361111111` con estado `bloqueado`.
  - `5493362222222` con estado `requiereTransferencia`.
- **`POST /orders` valida el paso 2 de §5.3**, con 403 `CUSTOMER_BLOCKED` y
  `TRANSFER_REQUIRED`. El upsert y los contadores de customer siguen fuera de alcance.
- **Vencimiento al leer:** en `GET /orders/:codigo` y `GET /slots`, todo pedido `pendiente` con
  `expiresAt ≤ now` pasa a `cancelado` con motivo `vencido` y libera su cupo.

#### Lógica de jornada

- Si la lógica de jornada y horarios del mock sirve para el header (próxima apertura), se mueve a
  `shared/utils` como función pura, con `now` como parámetro y tests.
- La usan los mocks y el front; no se duplica.

#### `localStorage`

Keys nuevas: `bs-cliente` (`{ nombre, caracteristica, numero }`) y `bs-pedido-activo`
(`{ codigo }`). Se documentan en `CLAUDE.md`.

### No

- Panel y services/mocks admin (Etapa 04).
- Upsert de customers, contadores y reglas de reputación (Etapas 04/06).
- API real y job de vencimiento real (Etapa 05).
- Subida de fotos a Cloudinary.
- Marca definitiva.
- PWA y analytics.
- Dependencias nuevas fuera de las ya instaladas.

## Archivos a crear o modificar

- `apps/web/src/components/*`: componentes base con su CSS.
- `apps/web/src/features/public/{catalogo,carrito,checkout,pedido}/`: `pages/`, `components/`,
  `hooks/` y CSS `pub-*`.
- `apps/web/src/features/public/**`: contexto del carrito (crear o completar), con reducer,
  persistencia en `bs-cart`, fusión y revalidación.
- `apps/web/src/hooks/`: `usePolling` (si hace falta) y `useCountdown`.
- `apps/web/src/lib/`: links `wa.me` y plantilla del mensaje de comprobante.
- `apps/web/src/services/mocks/`: fixture de customers, validación 403 y vencimiento al leer.
- `apps/web/src/services/queryKeys.ts`: keys que falten (`orderKeys.public(codigo)`, etc.).
- `packages/shared/src/utils/`: lógica de jornada, si se mueve, + tests.
- `CLAUDE.md`: keys de `localStorage` nuevas.
- `docs/ESTADO.md`

## Criterios de aceptación

- Se hace un pedido completo en mobile (375px): catálogo → detalle con quitados y extras →
  carrito → checkout → seguimiento.
- El "+" agrega directo solo en productos sin quitables ni extras.
- El mismo producto con la misma personalización se fusiona en una línea; editar reabre el sheet
  precargado.
- El botón atrás del celular cierra el sheet de detalle.
- Con un producto agotado o desactivado en el store del mock, la línea queda marcada y
  "Continuar" se bloquea hasta quitarla.
- El carrito, `bs-cliente` y `bs-pedido-activo` sobreviven a una recarga.
- Checkout:
  - Con `VITE_MOCK_FORCE_OPEN=false` fuera de horario, se ve el estado de cerrado.
  - Al llenar una franja se ve el 409 inline.
  - Con el teléfono `…1111111` sale el mensaje de bloqueado.
  - Con `…2222222` se fuerza transferencia.
- Seguimiento:
  - El countdown llega a 0.
  - En la siguiente lectura el pedido figura `cancelado`/`vencido` y el cupo vuelve a estar
    disponible.
  - "Enviar comprobante" abre `wa.me` con el texto correcto.
- Banner de pedido en curso: visible en el catálogo mientras el pedido no es final; desaparece al
  cancelarse.
- Toda pantalla tiene su estado de loading, vacío y error.
- Accesibilidad: targets de al menos `--tap-min`, `:focus-visible` y `prefers-reduced-motion`
  respetados.
- Estilos: ningún valor fuera de `tokens.css` y todo CSS con su `@layer`.
- `/admin` sigue en su chunk lazy: la app pública no descarga CSS `adm-*`.
- Pasan `typecheck`, `lint`, `test` y `build`.
- Deploy en Vercel con `VITE_USE_MOCKS=true` y `VITE_MOCK_FORCE_OPEN=true`, accesible desde el
  celular.

## Al terminar

Entrada en `docs/ESTADO.md`: fecha, qué se hizo y desvíos. Incluir la URL de la demo.
