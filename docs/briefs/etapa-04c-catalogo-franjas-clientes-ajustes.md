# Brief 04c — Catálogo, franjas, clientes y ajustes

## Objetivo
Construir el resto del panel sobre los services de 04a y dejar lista la Demo 2.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3, §8.2–8.5), docs/DESIGN_SYSTEM.md, docs/ESTADO.md.

## Alcance

### /admin/catalogo — tabs Productos, Categorías y Extras
- `Table` con la opción de mostrar u ocultar inactivos (ocultos por defecto). Los inactivos se
  ven atenuados y tienen "Reactivar".
- **Productos:**
  - Tabla agrupada por categoría.
  - Columnas: foto chica, nombre, precio y `Switch` "Disponible", que aplica el PATCH directo.
  - Tocar la fila abre el formulario en un Drawer: nombre, descripción, categoría (`Select`),
    precio, foto (`uploadProductPhoto`, con preview y opción de reemplazar), quitables (input que
    agrega chips, con ✕ para sacar) y extras con checkboxes.
- **Categorías:** nombre y switch activa.
- **Extras:** nombre, precio, `cantidadMax` y switch "Disponible".
- **Orden:** flechas ↑↓ por fila, que intercambian el `orden` con la fila vecina (2 PUT). Aplica a
  las categorías y a los productos dentro de cada categoría.
- **Desactivar:** Modal de confirmación.
- **Botón "Nuevo":** en cada tab.

### /admin/franjas (solo la jornada actual, sin selector de fecha)
- **Fila por franja:**
  - La hora.
  - Barra `ocupados/cupoMax`: `--warning` al 80 %, `--danger` al llenarse.
  - `Stepper` de cupo con mínimo = `ocupados`, PATCH con debounce de ~500 ms.
  - `Switch` "Abierta", que aplica al instante.
- **Pasadas** (`inicio < now`): atenuadas y sin edición.
- **Dentro de la anticipación mínima:** badge "Ya no se ofrece".
- **`huerfana`:** badge "Fuera de horario"; muestra los ocupados.
- **Polling:** cada 10 s.
- **Sin acciones masivas.**

### /admin/clientes
- `Table` por `ultimoPedidoAt` desc, con columnas:
  - Nombre y teléfono.
  - Pedidos, entregados y no-shows.
  - Badge de estado.
  - Ícono si es `estadoManual`.
- Búsqueda con `q` (debounce, mínimo 2 caracteres).
- Chips de filtro: Todos, Requiere transferencia, Bloqueados (filtro en el front sobre el resultado).
- Soporta `?q=` en la URL, para el link desde el detalle de la comanda.
- **Detalle (Drawer):**
  - Contadores.
  - `Select` de estado (cambiarlo marca `estadoManual`, §8.5).
  - `Switch` "Estado manual".
  - Botón wa.me para escribirle al cliente.

### /admin/ajustes
Un formulario con secciones y un botón "Guardar" sticky, habilitado solo cuando hay cambios.
Si alguien sale con cambios sin guardar, se le avisa.
- **General:** `Switch` "Tomar pedidos".
- **Horarios:** 7 filas, una por día, con switch activo, abre y cierra. Nota "Cierra al día
  siguiente" si `cierra < abre`.
- **Franjas:**
  - Intervalo (`Select`: 10, 15, 20 o 30).
  - Cupo por defecto.
  - Anticipación mínima.
- **Transferencia:**
  - Minutos.
  - Alias, CBU y titular.
  - `telefonoLocal` en dos campos, normalizado con `normalizarTelefono`.
- **Mensajes:**
  - Un Textarea por plantilla.
  - Chips de variables que insertan en la posición del cursor.
  - Preview en vivo con un pedido de ejemplo.
- **Al guardar** con cambios de horarios o intervalo y pedidos activos en la jornada: Modal
  "Hay N pedidos activos hoy. Los cambios de horario e intervalo aplican ya."

### Estados
En cada pantalla: Skeleton, vacío y `ErrorState`. Errores de mutación → toast. Errores de
validación → inline.

## No incluye
Reglas automáticas de reputación (Etapa 06). La subida real a Cloudinary (Etapa 05).

## Archivos
`features/admin/{catalogo,franjas,clientes,ajustes}/**` con su CSS `adm-*`.

## Criterios de aceptación (Chrome headless, 1280 px y 768 px)
- Producto nuevo con foto, quitables y extras → aparece en el catálogo público.
- Toggle "Disponible" → "Agotado" en el público.
- Desactivar → desaparece del público; con "Reactivar" vuelve.
- Mover ↑↓ → cambia el orden en el público.
- Foto: persiste después de recargar.
- Franjas: cerrar una → no se ofrece en el checkout. El cupo no baja de `ocupados`.
- Cambiar el intervalo con pedidos activos → aviso y franjas `huerfana` visibles.
- Clientes: se encuentra por "4123456" y por "juan" (también "Juán").
- Bloquear a un cliente → el checkout da 403. Aparece el ícono de manual.
- Ajustes: la plantilla editada se usa en el wa.me de la comanda. Salir sin guardar → aviso.
- Sin errores de consola. typecheck, lint, test y build pasan.

## Al terminar
Actualizar docs/ESTADO.md, marcar la Etapa 04 como lista para la Demo 2 y dejar anotado cómo
correrla: dos pestañas (pública y panel), `VITE_MOCK_SIMULAR=true` y las credenciales mock.