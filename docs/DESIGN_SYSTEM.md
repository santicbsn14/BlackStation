# Black Station — Design System

CSS plano: `@layer`, custom properties, nesting nativo y `clamp()`. Sin CSS Modules, sin
preprocesadores, sin librerías de UI.

---

## 1. Arquitectura

```
apps/web/src/styles/
├── index.css          ← declara el orden de layers e importa todo lo global
├── tokens.css         ← solo custom properties en :root (sin layer)
├── fonts.css          ← import de @fontsource-variable/archivo
├── reset.css          → @layer reset
├── base.css           → @layer base
├── layout.css         → @layer layout
├── components/        → @layer components (uno por componente)
└── utilities.css      → @layer utilities

features/public/**/*.css   → @layer features
features/admin/**/*.css    → @layer features
```

Orden de capas (primera línea de `index.css`):

```css
@layer reset, base, layout, components, features, utilities;
```

- La cascada la resuelve la capa, no la especificidad. No se usa `!important`.
- `index.css` se importa una sola vez en `main.tsx`, **como primer import**: el orden de `@layer` lo fija
  la primera aparición, y si el CSS de un componente llega antes su capa queda por debajo de `base`.
- El CSS de cada componente se importa desde su `.tsx`. El de `features/admin` viaja en el chunk
  lazy de `/admin`: la app pública nunca lo descarga.

## 2. Nombres

| Tipo | Convención | Ejemplo |
|---|---|---|
| Componente | BEM sin prefijo | `.btn`, `.btn--primary`, `.card__title` |
| Layout | `l-` | `.l-stack`, `.l-cluster`, `.l-container`, `.l-grid` |
| Pantalla pública | `pub-` + BEM | `.pub-catalogo__grid` |
| Pantalla panel | `adm-` + BEM | `.adm-comanda__columna` |
| Utilidad | `u-` | `.u-visually-hidden`, `.u-tabular` |
| Estado de UI | `is-` | `.is-active`, `.is-loading`, `.is-disabled` |
| Estado de dominio | `data-*` con el valor del enum | `.badge[data-estado="confirmado"]` |

Nesting: máximo un nivel + pseudo-clases/estados (`&:hover`, `&.is-active`, `&[data-estado="x"]`).

## 3. Tokens (`tokens.css`)

```css
:root {
  /* Marca */
  --color-black: #0C0C0C;
  --color-orange: #FD6001;
  --color-orange-hover: #FF7A26;
  --color-orange-pressed: #E05500;
  --color-orange-soft: rgb(253 96 1 / 0.12);
  --color-white: #FFFFFF;

  /* Superficies (tema oscuro único) */
  --bg: var(--color-black);
  --surface-1: #161616;
  --surface-2: #1F1F1F;
  --border: #2A2A2A;
  --border-strong: #3A3A3A;

  /* Texto */
  --text: var(--color-white);
  --text-muted: #A3A3A3;
  --text-on-accent: var(--color-black);
  --accent: var(--color-orange);

  /* Estados de pedido */
  --estado-pendiente: #EAB308;
  --estado-confirmado: #3B82F6;
  --estado-entregado: #22C55E;
  --estado-cancelado: #EF4444;

  /* Feedback */
  --danger: #EF4444;
  --success: #22C55E;
  --warning: #EAB308;

  /* Tipografía */
  --font-sans: "Archivo Variable", "Archivo", system-ui, sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  --fs-xs: 0.75rem;
  --fs-sm: 0.875rem;
  --fs-base: 1rem;
  --fs-lg: 1.125rem;
  --fs-xl: 1.25rem;
  --fs-2xl: 1.5rem;
  --fs-3xl: clamp(1.75rem, 1.4rem + 1.5vw, 2.25rem);
  --fs-4xl: clamp(2.25rem, 1.8rem + 2vw, 3rem);
  --fw-regular: 400;
  --fw-semibold: 600;
  --fw-bold: 800;
  --wdth-condensed: 62;
  --lh-tight: 1.15;
  --lh-base: 1.5;

  /* Espaciado (base 4px) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  /* Forma */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 999px;

  /* Capas */
  --z-header: 10;
  --z-drawer: 20;
  --z-modal: 30;
  --z-toast: 40;

  /* Movimiento */
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;

  /* Tamaños */
  --tap-min: 44px;
  --container-max: 1200px;
}
```

## 4. Decisiones

- **Tema oscuro único** en la app pública y el panel. No hay light mode.
- **Botón primario:** fondo `--accent`, texto `--text-on-accent` (negro). Negro sobre `#FD6001`
  ≈ 6.4:1 (AA). Blanco sobre naranja ≈ 3:1: **no se usa** para texto normal.
- **Elevación con superficies y bordes**, no con sombras (en fondo negro no se ven).
- **Tipografía:** Archivo variable, self-hosteada con `@fontsource-variable/archivo`. Una sola familia.
  - Títulos de display: mayúsculas, `font-variation-settings: "wdth" var(--wdth-condensed)`,
    `--fw-bold`, `--lh-tight`. Hacen eco al lettering condensado del logo.
  - Cuerpo: ancho normal, `--fw-regular`, `--lh-base`.
- **Números:** precios, horas y números de pedido con `font-variant-numeric: tabular-nums`
  (`.u-tabular`).
- **Estados de pedido:** siempre color + texto (nunca solo color). Badge con fondo del color al
  15% y texto/borde del color pleno.

## 5. Breakpoints

Mobile-first. Las custom properties no funcionan en media queries, así que los valores se usan
literales y **solo estos**:

| Nombre | Media query |
|---|---|
| sm | `(min-width: 480px)` |
| md | `(min-width: 768px)` |
| lg | `(min-width: 1024px)` |

- App pública: diseñada para celular.
- Panel: diseñado para notebook; usable en tablet (md).

## 6. Accesibilidad mínima

- Targets táctiles de al menos `--tap-min`.
- `:focus-visible` con `outline: 2px solid var(--accent); outline-offset: 2px`.
- `@media (prefers-reduced-motion: reduce)` anula transiciones y animaciones.
- Contraste AA en todo texto sobre fondo.

## 7. Ticket 80 mm (preview en el panel)

- Componente `.ticket` con paleta propia, independiente del tema: fondo blanco, texto negro,
  `--font-mono`.
- Ancho `72mm` (área imprimible real de un papel de 80 mm a 203 dpi).
- Hora de retiro en `--fs-4xl` bold, arriba de todo. Número de pedido grande debajo.

## 8. Reglas

- Ningún hex, `rgb()`, espaciado, radio ni z-index fuera de `tokens.css` (excepción: `1px` de borde).
- Todo archivo CSS declara su `@layer`, salvo `tokens.css` y `fonts.css` (solo custom properties y `@font-face`).
- Un componente = un archivo CSS con el mismo nombre (`Button.tsx` → `button.css`).
- Nada de estilos inline salvo valores dinámicos imposibles en CSS (ej. un `--progress` calculado).

## 9. Componentes base

Se construyen en las Etapas 03 y 04, a medida que se necesitan:

`btn`, `field` / `input`, `select`, `chip` (quitar ingredientes), `stepper` (cantidad),
`switch` (disponible), `badge` (estados), `card`, `drawer` (carrito), `modal`, `toast`,
`table` (ABM), `countdown` (vencimiento de transferencia), `ticket`.

## 10. Marca

| Asset | Uso | Ubicación |
|---|---|---|
| `logo.svg` | Logo completo con texto en arco (hero, login del panel) | `apps/web/src/assets/brand/` |
| `isotipo.svg` | Solo la hamburguesa (header mobile) | `apps/web/src/assets/brand/` |
| `favicon.svg` | Isotipo sobre cuadrado negro redondeado | `apps/web/public/` |

- Originales en `docs/brand/`.
- El texto del logo está convertido a curvas (Archivo condensado): no depende de fuentes.
- El logo nunca se recrea con texto HTML: siempre el SVG.
- **Placeholder:** se emprolija antes de producción (Etapa 08).
