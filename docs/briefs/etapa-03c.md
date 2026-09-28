# Brief — Etapa 03c: repaso antes de enviar + cancelación por el cliente

## Objetivo
Sumar un sheet de confirmación antes de crear el pedido y permitir que el cliente cancele su
pedido mientras está `pendiente`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3.4, §4, §6, §10), docs/ESTADO.md (entrada Etapa 03).

## Alcance

### Sí

**1. MODELO_DATOS.md (primero)**
- §3.4: `motivoCancelacion` suma `cliente`.
- §4: fila nueva en la tabla de transiciones: `pendiente` → `cancelado`, motivo `cliente`,
  quién Cliente, efectos `canceladoAt = now` y libera el cupo. No toca `customers` (no es no-show).
  Nota: `cliente` solo lo asigna este endpoint; el panel no puede usarlo.
- §6: endpoint nuevo `POST /api/orders/:codigo/cancelar`, sin body, sin auth (el `codigo` actúa
  de credencial).
  - Respuesta: el mismo JSON que `GET /api/orders/:codigo`.
  - Errores: 404 `ORDER_NOT_FOUND`; 409 `INVALID_TRANSITION` si el pedido no está `pendiente`.
  - Se aplica con condición `estado: 'pendiente'` para no pisarse con el job de vencimiento.
- §10: sin codes nuevos.

**2. shared**
- `cliente` en el enum de motivos de cancelación.
- Transición en `transitions.ts`.
- Tests.

**3. Services, mocks y hook**
- `cancelOrder(codigo)` en `api/` y `mocks/`. El mock valida el estado, libera el cupo y
  devuelve los errores de §10.
- Hook `useCancelOrder`: invalida `orderKeys.public(codigo)` y borra `bs-pedido-activo`.

**4. Checkout: sheet de repaso**
- "Confirmar pedido" valida el formulario y, si está todo bien, abre un sheet (`Drawer` bottom)
  en lugar de enviar.
- Título del sheet: "¿Hacemos el pedido?".
- Muestra "Retirás hoy a las HH:mm · Total $X" y un texto según el método de pago:
  - Transferencia: "Pagás por transferencia: vas a tener {minutosTransferencia} min para mandar
    el comprobante por WhatsApp. Si no llega, el pedido se cancela solo."
  - Al retirar: "Pagás al retirar. Te confirmamos por WhatsApp."
- Botones "Volver" y "Sí, hacer pedido". El segundo lleva spinner y bloquea el doble envío.
- Si el POST da error, se cierra el sheet y se aplica la tabla de errores de la Etapa 03.

**5. Seguimiento: cancelar**
- Solo en `pendiente`: botón secundario "Cancelar pedido", debajo del bloque principal.
- Al tocarlo se abre un sheet de confirmación:
  - Título: "¿Cancelar el pedido #N?"
  - Aviso: "Si ya transferiste, no canceles: escribinos por WhatsApp."
    Debajo, un botón `wa.me` al local.
  - Botones "Volver" y "Sí, cancelar" (estilo peligro).
- Si el cancel responde 409, se hace un refetch y sale el toast "Tu pedido ya fue confirmado.
  Si necesitás cambiarlo, escribinos por WhatsApp."
- Estado `cancelado` con motivo `cliente`: "Cancelaste tu pedido." + "Hacer un nuevo pedido".

### No
- Panel (el label "Cancelado por el cliente" va en la Etapa 04).
- API real (Etapa 05).
- Cancelación en `confirmado`.
- Dependencias nuevas.

## Archivos a crear o modificar
- docs/MODELO_DATOS.md
- packages/shared/src/{enums.ts, transitions.ts} + tests
- apps/web/src/services/{api,mocks}/ (orders)
- apps/web/src/features/public/{checkout,pedido}/
- docs/ESTADO.md

## Criterios de aceptación
- "Confirmar pedido" con el formulario inválido marca los errores y no abre el sheet.
- Con el formulario válido abre el sheet, y el texto cambia según el método de pago.
- "Volver" no crea nada.
- Un error 409 de franja cierra el sheet y se muestra inline en la sección horario.
- Cancelar en `pendiente`:
  - pasa a `cancelado`/`cliente`,
  - libera el cupo (la franja vuelve a aparecer en el checkout),
  - borra el banner de pedido en curso.
- En `confirmado`, `entregado` y `cancelado` no aparece el botón de cancelar.
- Cancelar un pedido que se confirmó en el medio muestra el toast y el estado actualizado.
- Pasan typecheck, lint, test y build.

## Al terminar
Entrada en docs/ESTADO.md.