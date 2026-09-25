# Black Station — Estado del proyecto

## Etapas

| Etapa | Descripción | Estado |
|---|---|---|
| 01 | Modelo de datos, estados, reglas de negocio y endpoints | ✅ Cerrada |
| 02 | Setup del monorepo | Pendiente |
| 06 | Reglas de reputación de clientes | Pendiente |

## Documentos

- [MODELO_DATOS.md](MODELO_DATOS.md) — fuente de verdad del modelo de datos, estados,
  reglas de negocio y endpoints.

## Registro de cambios

### 2026-09-25 — Etapa 01 cerrada
- Creado `docs/MODELO_DATOS.md`: convenciones de formato, 8 colecciones con campos e índices,
  diagrama de estados del pedido, reglas de negocio y endpoints por nivel de acceso.
- Agregado `extras.activo` para soportar el borrado soft del CRUD de extras.
- Quedan pendientes: reglas de reputación (Etapa 06) y valores por defecto de `settings`.
