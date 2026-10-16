# Brief 05c — Catálogo público, CRUD del panel y fotos en Cloudinary

## Objetivo
Implementar todo el catálogo en la API:
- `GET /api/catalog`.
- CRUD admin de categorías, productos y extras, con borrado soft, `disponible` y reactivación.
- Firma de subida a Cloudinary.
- Borrado de la foto vieja cuando se reemplaza o se saca.

El panel `/admin/catalogo` y el catálogo público pasan a funcionar contra la API real.
Guardá este brief en `docs/briefs/etapa-05c-catalogo-cloudinary.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§3.1–3.3, §6, §8.2, §10), docs/ESTADO.md.
Reglas y mensajes de referencia: `apps/web/src/services/mocks/admin.ts` (sección Catálogo) y
`getCatalog` en `apps/web/src/services/mocks/index.ts`.
Subida desde el front: `uploadProductPhoto` en `apps/web/src/services/api/index.ts`.

## Alcance

### 1. docs/MODELO_DATOS.md (primero)
- §6 `GET /api/catalog`: mismo armado que el `getCatalog` del mock.
  - Categorías `activa` ordenadas por `(orden, _id)`.
  - Dentro de cada una, productos `activo` ordenados por `(orden, _id)`.
  - Los extras de cada producto van en el orden de `extrasIds`, solo los `activo` + `disponible`.
  - Las categorías activas sin productos también vienen, igual que en el mock.
- §8.2 Listas admin:
  - Categorías y productos ordenados por `(orden, _id)`.
  - Extras por `createdAt`.
  - Incluyen inactivos.
- §8.2 Validaciones: las mismas reglas y mensajes que los mocks (helpers `texto`, `orden`, `precio`, `booleano`, `camposProducto` y `camposExtra`), en una tabla:
  - En el create, si falta un campo obligatorio: `Falta el nombre.`, `Falta la categoría.` o `Falta el precio.`.
  - `categoriaId` tiene que existir (puede estar inactiva).
  - Cada id de `extrasIds` tiene que existir. Se deduplican.
  - `ingredientesQuitables`: con trim y deduplicados.
  - Un id mal formado en el body se responde con el mismo mensaje que uno inexistente.
  - Todo error de validación es 400 `VALIDATION_ERROR`.
- §8.2 `:id` inexistente o mal formado: 404 `NOT_FOUND` con el mensaje del mock (`No encontramos esa categoría.`, `No encontramos ese producto.`, `No encontramos ese extra.`).
- §8.2 Fotos:
  - `fotoUrl` y `fotoPublicId` van juntos: los dos `null` o los dos string.
  - `fotoPublicId` tiene que empezar con `blackstation/products/`.
  - `fotoUrl` tiene que empezar con `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/`.
  - Si no cumplen, 400 `VALIDATION_ERROR` con `Foto inválida.`. Así nadie puede apuntar a otra cuenta ni hacer borrar fotos ajenas.
- §8.2 Foto vieja:
  - Si un `PUT` cambia `fotoPublicId` (a otro valor o a `null`), después de guardar se borra la anterior en Cloudinary, en segundo plano.
  - Si el borrado falla, queda en el log y no afecta la respuesta.
  - El `DELETE` (soft) no borra la foto, porque el producto se puede reactivar.
  - Las fotos subidas pero nunca guardadas en un producto quedan en Cloudinary (aceptado).
- §8.2 `POST /api/admin/uploads/signature`:
  - `folder` solo admite `products` (default `products`); cualquier otro valor da 400 `VALIDATION_ERROR`.
  - La carpeta final es `blackstation/products`.
  - La firma es el sha1 en hex de `folder=<folder>&timestamp=<timestamp>` concatenado con el api secret.
  - `timestamp` en segundos, tomado de `now()`.

### 2. apps/api
- `lib/cloudinary.ts`:
  - `firmarParams(params)`: params ordenados alfabéticamente, `k=v` unidos con `&`, + secret, sha1 hex.
  - `destroyImage(publicId)`: `POST https://api.cloudinary.com/v1_1/<cloud>/image/destroy` con `public_id`, `timestamp`, `api_key` y `signature`, usando `fetch` nativo. Sin SDK.
- `mappers/catalog.ts`:
  - `toCategory`, `toProduct`, `toExtra`: `_id` y refs como string, fechas ISO.
  - `toCatalog(...)`: arma la respuesta pública.
- `validators/catalog.ts`:
  - zod con `regla()` de `validators/common.ts`, para mantener los mensajes del mock.
  - Body de create, update y `disponible` de cada entidad.
  - Helper de `:id` que responde 404 con el mensaje de la entidad.
- `services/catalog.ts`:
  - Público: `getCatalog`.
  - Categorías: `list`, `create`, `update`, `softDelete`.
  - Productos: `list`, `create`, `update`, `softDelete`, `setDisponible`.
  - Extras: `list`, `create`, `update`, `softDelete`, `setDisponible`.
  - Las existencias de `categoriaId` y `extrasIds` se validan en el service.
  - Todo devuelve tipos de shared.
- `services/uploads.ts`: `getUploadSignature(folder)`.
- `controllers/` + `routes/`:
  - `routes/public.ts` suma `GET /catalog`.
  - `routes/admin/` suma `categories`, `products`, `extras` y `uploads`, montados en `routes/admin/index.ts`.
- `npm run format` sobre `seed/runSeed.ts` y `test/models.test.ts` (pendiente de la 05a).

### Fuera de alcance
- Franjas, pedidos, clientes, job de vencimiento y print server.
- Cambios en el front: `services/api` ya implementa todos estos endpoints y la subida directa.

## Archivos a crear o modificar
- Crear:
  - Los de §2.
  - `apps/api/test/catalog.public.test.ts`, `catalog.admin.test.ts`, `uploads.test.ts`, `cloudinary.test.ts`.
  - `docs/briefs/etapa-05c-catalogo-cloudinary.md`.
- Modificar: `routes/public.ts`, `routes/admin/index.ts`, `docs/MODELO_DATOS.md`, `docs/ESTADO.md`.

## Criterios de aceptación
Supertest + mongodb-memory-server. En los tests, `fetch` hacia Cloudinary va mockeado con `vi.spyOn(globalThis, 'fetch')`: ningún test sale a la red.

- `GET /api/catalog`, sin auth:
  - Excluye categorías inactivas y productos inactivos.
  - Incluye los productos `disponible: false`.
  - Excluye los extras inactivos o no disponibles.
  - Respeta los órdenes de §6.
  - No expone `activo`, `categoriaId`, `fotoPublicId` ni `extrasIds`.
- Con el catálogo del seed `--demo`, la respuesta es igual a la del `getCatalog` del mock con los mismos datos. Se compara contra un snapshot armado desde los JSON.
- CRUD de cada entidad:
  - `POST` → 201 con los defaults de §3.
  - `PUT` parcial → solo cambia lo enviado y actualiza `updatedAt`.
  - `DELETE` → `{ ok: true }`, el documento sigue y queda inactivo.
  - `PUT` con `activa: true` o `activo: true` → reactiva.
  - `PATCH .../disponible` → cambia solo `disponible`.
- Validaciones (400 `VALIDATION_ERROR` con el mensaje exacto del mock):
  - Nombre vacío.
  - Precio negativo o decimal.
  - Orden `-1`.
  - `cantidadMax` 0.
  - `categoriaId` inexistente o mal formado.
  - Un `extrasIds` inexistente.
  - Ingrediente vacío.
  - `disponible: "si"`.
  - Faltan nombre, categoría o precio en el create.
- `:id` inexistente o mal formado → 404 `NOT_FOUND` con el mensaje de la entidad.
- Sin token → 401 en todas las rutas admin.
- Fotos:
  - `fotoUrl` sin `fotoPublicId`, `publicId` de otra carpeta o URL de otra cuenta → 400 `Foto inválida.`.
  - Un `PUT` que cambia la foto llama a `destroy` con el `publicId` viejo.
  - Un `PUT` que la pone en `null` también llama a `destroy`.
  - Un `PUT` sin cambio de foto no lo llama.
  - Un `destroy` que falla (fetch rechaza o devuelve 500) no cambia la respuesta: sigue 200.
  - El `DELETE` soft no lo llama.
- Firma:
  - Responde `{ signature, timestamp, apiKey, cloudName, folder: 'blackstation/products' }`.
  - `signature` coincide con un sha1 calculado a mano en el test con un secret fijo.
  - `folder: 'otra'` → 400.
- Manual, con tus credenciales de Cloudinary en `apps/api/.env` y la web con `VITE_USE_MOCKS=false`:
  - En `/admin/catalogo` se puede crear, editar, dar de baja, reactivar y marcar agotado.
  - Subir una foto funciona.
  - Reemplazarla hace que la vieja desaparezca de la Media Library de Cloudinary.
  - El catálogo público `/` muestra los cambios.
- `npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
Actualizar `docs/ESTADO.md` (entrada 05c con lo hecho y los desvíos), commit `feat: catálogo y Cloudinary (05c)` y `git push` a `main`.
