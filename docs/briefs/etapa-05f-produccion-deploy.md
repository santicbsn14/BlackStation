# Brief 05f — Preparación para producción y guía de deploy

## Objetivo
Dejar la API y la web listas para deployar en Render (API en Web Service Starter, web en Static Site)
con Atlas, Cloudinary y UptimeRobot a nombre de la clienta, y escribir `docs/DEPLOY.md` con los
pasos exactos. No se deploya nada en este brief: eso lo hace Santiago siguiendo la guía.
Guardá este brief en `docs/briefs/etapa-05f-produccion-deploy.md`.

## Docs a leer
CLAUDE.md, docs/MODELO_DATOS.md (§7 límite de intentos, §5.3 topes), docs/ESTADO.md.

## Alcance

### 1. apps/api
- **`TRUST_PROXY`** (env, entero ≥ 0, default `1`): reemplaza el `app.set('trust proxy', 1)` fijo.
  Sumarlo a `config/env.ts`, `.env.example` y la tabla de CLAUDE.md.
- **Diagnóstico de IP:** en cada login fallido y en cada 429 (`TOO_MANY_ATTEMPTS` /
  `TOO_MANY_ORDERS`), `console.warn` con `req.ip` y el header `X-Forwarded-For` crudo. Sirve
  para verificar en los logs de Render que `req.ip` es la IP real del cliente y no la de un proxy.
  No loguear el usuario, el password ni el teléfono.
- **`seed:prod`** en `apps/api/package.json`: `node dist/seed/index.js` (el seed ya compilado; en
  Render no hay `tsx` en runtime). Debe funcionar desde la raíz del repo después de `build:api`
  (los `data/*.json` relativos al archivo compilado).
- Verificar que `npm run start -w @blackstation/api` levanta desde la raíz con solo `dist/` y
  `node_modules` (sin `tsx`, sin `src/`).

### 2. apps/web
- Nada de código. Confirmar que `npm run build` desde la raíz deja todo en `apps/web/dist` y que no
  depende de `vercel.json` (queda para la demo de Vercel).

### 3. docs/DEPLOY.md (nuevo)
Guía paso a paso, en español rioplatense, para alguien que nunca usó Render. Secciones:
1. **Cuentas a nombre de la clienta:** Render, MongoDB Atlas, Cloudinary, UptimeRobot (Santiago como
   miembro/colaborador donde se pueda).
2. **Atlas producción:** proyecto "Black Station", cluster M0 en **AWS us-east-1 (N. Virginia)**,
   base `blackstation`, usuario de base con password alfanumérico, Network Access `0.0.0.0/0`
   (Render Starter no tiene IP fija), URI `mongodb+srv://…/blackstation?...`.
3. **Cloudinary producción:** cuenta nueva de la clienta; dónde sacar cloud name, API key y secret.
4. **Render — API (Web Service, plan Starter, región Virginia):**
   - Repo, branch `main`, root directory vacío (raíz del monorepo).
   - Build command: `npm ci --include=dev && npm run build:api` (`--include=dev` porque con
     `NODE_ENV=production` npm omite las devDependencies y tsup no estaría).
   - Start command: `npm run start -w @blackstation/api`.
   - Health check path: `/health`.
   - Variables: `NODE_VERSION=24`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` y
     `PRINT_KEY` **nuevos** (comando para generarlos), `CORS_ORIGINS` (URL del Static Site y, si
     hay, el dominio propio), `CLOUDINARY_*` de la clienta, `TRUST_PROXY=1`, `FORCE_OPEN=false`.
     Aclarar que **no** van `SEED_*` fijas.
5. **Seed de producción:** desde la **Shell** del servicio en Render, con `SEED_ADMIN_USUARIO`,
   `SEED_ADMIN_PASSWORD` y `SEED_ADMIN_NOMBRE` pasadas en la misma línea del comando:
   `SEED_ADMIN_USUARIO=... SEED_ADMIN_PASSWORD=... SEED_ADMIN_NOMBRE="Black Station" npm run seed:prod -w @blackstation/api`
   (sin `--demo`: el catálogo real lo carga la clienta). Verificar con `/health` y el login.
6. **Render — Web (Static Site):** build `npm ci && npm run build`, publish `apps/web/dist`,
   variables `VITE_USE_MOCKS=false`, `VITE_API_URL=https://<api>.onrender.com`,
   `VITE_FORCE_OPEN=false`; **Redirects/Rewrites:** source `/*`, destination `/index.html`,
   action **Rewrite**.
7. **CORS:** después de crear el Static Site, agregar su URL a `CORS_ORIGINS` de la API (y
   redeploy).
8. **Verificación de IP (`TRUST_PROXY`):** hacer un login fallido desde el celular con datos
   móviles, mirar el log en Render y comparar `req.ip` con la IP pública del celular. Si `req.ip` es
   una IP interna o de proxy, probar `TRUST_PROXY=2` (o lo que indique el `X-Forwarded-For`).
9. **UptimeRobot:** monitor HTTP(s) a `https://<api>.onrender.com/health` cada 5 min, alerta por
   email a la clienta y a Santiago.
10. **Dominio propio (opcional):** comprar en NIC Argentina, agregarlo en Render (Static Site →
    Custom Domains), cargar los registros DNS que indica Render, sumar el dominio a `CORS_ORIGINS`.
11. **Checklist final:** pedido real de punta a punta en producción desde un celular.

### Fuera de alcance
- Crear cuentas o deployar. Print server (Etapa 07), reputación (Etapa 06), marca y settings reales (Etapa 08).

## Archivos a crear o modificar
Crear: `docs/DEPLOY.md`, `docs/briefs/etapa-05f-produccion-deploy.md`.
Modificar: `apps/api/src/app.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.example`,
`apps/api/src/controllers/auth.ts`, el lugar donde se responden los 429 de pedidos,
`apps/api/package.json`, `CLAUDE.md` (variables, `seed:prod`, link a DEPLOY.md),
`docs/ESTADO.md`. Tests de env para `TRUST_PROXY`.

## Criterios de aceptación
- `TRUST_PROXY` inválido (`-1`, `abc`) → la API no arranca y lo dice. Default 1.
- Un login fallido y un 429 dejan un `console.warn` con `req.ip` y `X-Forwarded-For`, sin
  usuario/password/teléfono (test con spy de `console.warn`).
- Desde la raíz: `npm run build:api && npm run seed:prod -w @blackstation/api` (con env de prueba)
  corre el seed compilado, y `npm run start -w @blackstation/api` levanta y `/health` responde.
- `docs/DEPLOY.md` completo con los 11 puntos.
- `npm run typecheck`, `lint`, `test`, `build` y `build:api` pasan.

## Al terminar
Actualizar `docs/ESTADO.md` (entrada 05f, con lo hecho y desvíos), commit
`feat: preparación para producción (05f)` y `git push` a `main`.
