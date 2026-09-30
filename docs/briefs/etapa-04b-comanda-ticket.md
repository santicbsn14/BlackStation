# Brief 04b — Comanda, detalle del pedido y preview del ticket

## Objetivo
Construir `/admin` (comanda en vivo) sobre los services de 04a.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§4, §5.4, §5.6, §5.7, §8.1), docs/DESIGN_SYSTEM.md, docs/ESTADO.md.

## Alcance

### Layout
- Notebook: 3 columnas.
  - **Pendientes:** primero los de transferencia por `expiresAt` asc; después los de pago al
    retirar por `createdAt` asc.
  - **Confirmados:** por `horaRetiro` asc.
  - **Finalizados:** entregados y cancelados, por `updatedAt` desc; columna más angosta.
- md: tabs con contador ("Pendientes 3 · Confirmados 7 · Finalizados 12").

### Header
- Jornada.
- Estado abierto/cerrado.
- Switch "Tomar pedidos" (`pedidosHabilitados`, GET + PUT de settings). Cuando está apagado:
  aviso "Pedidos pausados" en `--warning`.
- Toggle de sonido.

### Polling
- Carga inicial sin `since`. Después, cada 5 s con `?since=<serverTime>`; merge por `_id` con
  `setQueryData`.
- `refetchIntervalInBackground: true`.
- Resync completo cada 5 min, al volver el foco después de un rato y al cambiar la jornada.
- Error de red: banner "Sin conexión, reintentando… (última actualización HH:mm)", manteniendo
  los datos que ya había.

### Pedido nuevo
- Aplica a un `_id` que no estaba (no en la carga inicial): borde `--accent` con pulso hasta que
  se toca la card o pasan 30 s, y contador en el título de la pestaña ("(2) Comanda").
- Sonido: beep de 2 tonos con Web Audio (sin archivo); una vez por polling aunque lleguen varios.
  Preferencia en `localStorage` `bs-sonido`. Si está activado y el audio bloqueado: banner
  "Tocá para activar el sonido". Los cambios de estado no suenan.

### Card
- `#numero` y `horaRetiro` grandes (tabular).
- Nombre, badge del método de pago y total.
- Ítems abreviados (`2× Lomito completo (sin cebolla, +cheddar)`, y "+N más" si son muchos).
- Ícono de aclaración con el texto truncado.
- Transferencia pendiente:
  - `Countdown` a `expiresAt`: `--warning` con menos de 5 min, `--danger` con menos de 2 min.
  - Botón "Extender plazo" → toast "Plazo extendido hasta las HH:mm".
  - Botón wa.me "Pedir transferencia" (`mensajes.pedirTransferencia`).
- Acción principal con un toque directo, sin confirmación y deshabilitada mientras viaja el
  PATCH:
  - "Confirmar" en pendientes.
  - "Entregar" en confirmados.
- Confirmados: indicador "En cola" (`impresoAt` null) o "Impreso".
- Cancelados: badge más el motivo en texto: "Venció", "Canceló el cliente", "No retiró" o
  "Cancelado por el local".

### Detalle (Drawer derecho)
- Ítems completos, aclaración y total.
- Datos del cliente: teléfono, contadores, badge de estado y link a su ficha en `/admin/clientes`
  (búsqueda con `q` = teléfono).
- Preview del `Ticket`.
- Botones wa.me:
  - Pendiente por transferencia: "Pedir transferencia".
  - Confirmado: "Confirmación" y "Recordatorio".
  - Confirmar no abre WhatsApp.
- "Reimprimir" (solo `confirmado`).
- "Extender plazo" (pendiente por transferencia).
- "Cancelar" → Modal con motivo: `manual` (pendiente o confirmado) o `no_retiro` (solo confirmado).
- Si el pedido cambia mientras el drawer está abierto, se actualiza en vivo.

### Cancelaciones externas
Cuando un pendiente pasa a `cancelado` por `vencido` o por `cliente` (visto en el polling):
toast "#12 venció" o "#12 lo canceló el cliente".

### Errores de acciones
409 `INVALID_TRANSITION` → toast y refetch.

### Componente `Ticket` (`components/`)
- Renderiza la salida de `armarTicket`.
- 72mm, paleta propia (blanco y negro, `--font-mono`), según DESIGN_SYSTEM §7.

### Plantillas
Con `renderPlantilla` de `lib/` y las variables de §3.7.

### Estados de pantalla
- Skeleton en la carga inicial.
- Vacío: "Todavía no entraron pedidos hoy".
- Error: `ErrorState` con "Reintentar".

## No incluye
Catálogo, franjas, clientes y ajustes (04c).

## Archivos
`features/admin/comanda/**` (pages, components, hooks, CSS `adm-comanda`),
`components/Ticket.tsx` + `ticket.css`, `hooks/` genéricos si hacen falta (sonido, título).

## Criterios de aceptación (Chrome headless, 1280 px y 768 px)
- Pedido desde la pestaña pública → aparece en ≤ 5 s con pulso, sonido y contador en el título.
- Confirmar → pasa a Confirmados, "En cola" y a los 3 s "Impreso". Reimprimir vuelve a "En cola".
- Entregar → Finalizados.
- Cancelar con motivo → Finalizados con el motivo, y el cupo liberado.
- `no_retiro` no se ofrece en pendientes.
- Extender → el countdown se actualiza en la comanda y en el seguimiento del cliente.
- Vencimiento y cancelación del cliente → toast y Finalizados.
- Confirmar un pedido que vence en el medio → toast por el 409 y la card actualizada.
- wa.me con el texto de la plantilla correcta y las variables reemplazadas.
- Switch "Tomar pedidos" apagado → el checkout público da 423.
- Sin red → banner, y se recupera solo.
- Simulador activo → la comanda recibe pedidos sola.
- Sin errores de consola. typecheck, lint, test y build pasan.

## Al terminar
Actualizar docs/ESTADO.md.