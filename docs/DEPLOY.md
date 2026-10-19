# Black Station — Deploy a producción

Guía paso a paso para dejar Black Station andando en producción:

- **API** (`apps/api`) → Render, Web Service, plan Starter.
- **Web** (`apps/web`) → Render, Static Site (gratis).
- **Base** → MongoDB Atlas M0. **Imágenes** → Cloudinary. **Monitoreo** → UptimeRobot.

Todas las cuentas van **a nombre de la clienta** (ella es la dueña y la que paga). Santiago entra
como miembro o colaborador donde se pueda. Seguí las secciones en orden: varias usan datos de las
anteriores.

> Convenciones de esta guía: `<api>` es el nombre que le pongas al servicio de la API en Render (la
> URL queda `https://<api>.onrender.com`) y `<web>` el del Static Site
> (`https://<web>.onrender.com`). Anotá todo lo que diga **Anotar** en un lugar seguro (un gestor
> de contraseñas, no un chat).

---

## 1. Cuentas a nombre de la clienta

Crear con el email de la clienta (idealmente uno del negocio, no personal):

| Servicio | Para qué | Plan | Santiago |
|---|---|---|---|
| [Render](https://render.com) | API + web | Starter para la API (pago, con tarjeta de la clienta). El Static Site es gratis. | Workspace → **Settings → Members → Invite**, rol **Admin**. |
| [MongoDB Atlas](https://www.mongodb.com/atlas) | Base de datos | M0 (gratis) | Organización → **Access Manager → Invite to Organization**, rol **Organization Owner** (o Project Owner del proyecto "Black Station"). |
| [Cloudinary](https://cloudinary.com) | Fotos de productos | Free | **Settings → Users → Add user**, si el plan lo permite. Si no, Santiago no hace falta: solo se usan las credenciales. |
| [UptimeRobot](https://uptimerobot.com) | Avisar si la API se cae | Free | No hace falta invitarlo: se agrega su email como contacto de alerta (sección 9). |

Activá la verificación en dos pasos en las cuatro cuentas.

---

## 2. Atlas producción

1. En Atlas, crear un proyecto llamado **Black Station**.
2. **Create cluster** → **M0 (Free)**:
   - Provider: **AWS**.
   - Region: **N. Virginia (us-east-1)** (la misma región que Render Virginia: menos latencia).
   - Name: `blackstation`.
3. **Database Access** (menú Security) → **Add New Database User**:
   - Authentication: Password.
   - Usuario: `blackstation-api`.
   - Password: usá **Autogenerate Secure Password**. Tiene que ser **solo letras y números**: si
     tiene símbolos (`@`, `/`, `:`, `%`…) rompe la URI. Si el generado trae alguno, generá otro.
   - Role: **Read and write to any database**.
   - **Anotar:** usuario y password.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   Render Starter no tiene una IP de salida fija, así que no se puede restringir por IP. La
   protección es el usuario + password de la base.
5. **Database → Connect → Drivers** → copiá la URI. Se ve así:
   ```
   mongodb+srv://blackstation-api:<db_password>@blackstation.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=blackstation
   ```
   Reemplazá `<db_password>` por el password y agregá el nombre de la base, **`blackstation`**,
   entre el `/` y el `?`:
   ```
   mongodb+srv://blackstation-api:PASSWORD@blackstation.xxxxx.mongodb.net/blackstation?retryWrites=true&w=majority&appName=blackstation
   ```
   **Anotar:** esta URI es el `MONGODB_URI` de producción. No crees la base a mano: se crea sola
   con el seed (sección 5).

> Producción usa la base `blackstation`; desarrollo sigue con `blackstation-dev` en el cluster de
> desarrollo. Nunca apuntes el `.env` local a la base de producción.

---

## 3. Cloudinary producción

1. Crear la cuenta de la clienta (no reutilizar la de desarrollo: las fotos de prueba quedan allá).
2. En el **Dashboard** (o **Settings → API Keys**) están los tres datos:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** (botón del ojo para verlo) → `CLOUDINARY_API_SECRET`
3. **Anotar** los tres. El API Secret es una contraseña: no va en el front ni en el repo.

---

## 4. Render — API (Web Service)

### 4.1 Crear el servicio

1. Entrar a Render con la cuenta de la clienta (o como Santiago, dentro del workspace de la
   clienta).
2. **New → Web Service**.
3. Conectar el repo de GitHub `black-station`. Si Render no lo ve: **Configure GitHub** e instalar
   la app de Render en la cuenta de GitHub dueña del repo, dándole acceso a ese repo.
4. Completar:

| Campo | Valor |
|---|---|
| Name | `<api>` (por ejemplo `black-station-api`) |
| Language | Node |
| Branch | `main` |
| Region | **Virginia (US East)** |
| Root Directory | *(vacío: la raíz del monorepo)* |
| Build Command | `npm ci --include=dev && npm run build:api` |
| Start Command | `npm run start -w @blackstation/api` |
| Instance Type | **Starter** |

**Por qué `--include=dev`:** como el servicio tiene `NODE_ENV=production`, `npm ci` saltearía las
devDependencies, y `tsup` (el que compila la API) es una devDependency. En runtime no se usa nada
de eso: el start corre `node dist/index.js`.

### 4.2 Variables de entorno

En la misma pantalla (o después en **Environment**), cargar:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | La URI de la sección 2. |
| `JWT_SECRET` | **Nuevo**, generado con el comando de abajo. |
| `PRINT_KEY` | **Nuevo**, generado con el comando de abajo (otro distinto). |
| `CORS_ORIGINS` | Por ahora `https://<web>.onrender.com` (la URL que va a tener el Static Site; se confirma en la sección 7). Si hay dominio propio, se suma separado por coma. |
| `CLOUDINARY_CLOUD_NAME` | De la sección 3. |
| `CLOUDINARY_API_KEY` | De la sección 3. |
| `CLOUDINARY_API_SECRET` | De la sección 3. |
| `TRUST_PROXY` | `1` |
| `FORCE_OPEN` | `false` |
| `MONGOMS_DISABLE_POSTINSTALL` | `1` *(opcional: evita que el build descargue el binario de Mongo que solo usan los tests)* |

Para generar `JWT_SECRET` y `PRINT_KEY` (desde cualquier terminal con Node, una vez por cada uno):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Reglas:

- `JWT_SECRET` y `PRINT_KEY` de producción son **nuevos**: nunca los de desarrollo ni los de la demo.
- **No** cargar `SEED_ADMIN_USUARIO`, `SEED_ADMIN_PASSWORD` ni `SEED_ADMIN_NOMBRE` como variables
  del servicio: dejarían la contraseña del admin a la vista en el panel de Render. Se pasan solo
  en el comando del seed (sección 5).
- No cargar `PORT`: Render lo define solo y la API lo lee.
- **Anotar** `PRINT_KEY`: lo va a necesitar el print server (Etapa 07).

Si falta o está mal alguna variable, la API no arranca y el log del deploy dice cuál
(`Variables de entorno inválidas: - X: falta`).

### 4.3 Health check

**Settings → Health Checks → Health Check Path:** `/health`.

Render no da por bueno un deploy hasta que `/health` responde 200, y si deja de responder reinicia
el servicio. `/health` devuelve 503 si la API perdió la conexión con Mongo.

### 4.4 Primer deploy

**Create Web Service**. En **Logs** tiene que aparecer:

```
API escuchando en el puerto 10000 (production).
```

(el puerto lo elige Render). Probá en el navegador `https://<api>.onrender.com/health`:

```json
{ "ok": true, "time": "…" }
```

> **Auto-deploy:** por defecto Render redeploya en cada push a `main`. Un deploy reinicia los
> contadores de intentos de login y de pedidos por IP (viven en memoria; es lo esperado).

---

## 5. Seed de producción

Crea `settings` con los valores por defecto y el usuario admin. Se corre **una vez** (es
idempotente: correrlo de nuevo no pisa `settings` y solo actualiza nombre y contraseña del admin).

1. En el servicio de la API → pestaña **Shell** (disponible en el plan Starter). Arranca en la raíz
   del repo, con las variables del servicio ya cargadas.
2. Correr, en **una sola línea**, con el usuario y la contraseña que va a usar la clienta:
   ```sh
   SEED_ADMIN_USUARIO=admin SEED_ADMIN_PASSWORD='CONTRASEÑA-LARGA' SEED_ADMIN_NOMBRE="Black Station" npm run seed:prod -w @blackstation/api
   ```
   - La contraseña entre comillas simples si tiene símbolos.
   - **Sin `--demo`**: el catálogo real lo carga la clienta desde el panel.
3. Tiene que imprimir:
   ```
   Índices sincronizados.
   settings creado.
   Usuario "admin" actualizado.
   ```
4. Verificar:
   - `https://<api>.onrender.com/health` → `{ "ok": true, … }`.
   - Login desde el panel (después de la sección 6): `https://<web>.onrender.com/admin/login`.

`seed:prod` corre el seed **ya compilado** (`apps/api/dist/seed`): en Render no hay `tsx`. Por eso
necesita que el build esté hecho, cosa que en el Shell del servicio ya pasó.

Para cambiar la contraseña del admin más adelante: el mismo comando con la nueva contraseña.

---

## 6. Render — Web (Static Site)

1. **New → Static Site** → el mismo repo.
2. Completar:

| Campo | Valor |
|---|---|
| Name | `<web>` (por ejemplo `black-station`) |
| Branch | `main` |
| Root Directory | *(vacío)* |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `apps/web/dist` |

3. Variables de entorno:

| Variable | Valor |
|---|---|
| `VITE_USE_MOCKS` | `false` |
| `VITE_API_URL` | `https://<api>.onrender.com` (sin `/` al final, sin `/api`) |
| `VITE_FORCE_OPEN` | `false` |
| `MONGOMS_DISABLE_POSTINSTALL` | `1` *(opcional, igual que en la API)* |

   - **No** cargar `NODE_ENV=production` acá: el build de la web necesita las devDependencies
     (Vite).
   - La versión de Node la toma del `.nvmrc` (24); si querés dejarlo explícito, sumá
     `NODE_VERSION=24`.
   - Las `VITE_*` se "hornean" en el build: si cambiás una, hay que redeployar
     (**Manual Deploy → Deploy latest commit**).

4. **Redirects/Rewrites** → **Add Rule**:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | **Rewrite** |

   Sin esta regla, entrar directo a `/admin` o a `/pedido/ABCD2345` (o recargar ahí) da 404.
   (`apps/web/vercel.json` es solo para la demo de Vercel; Render no lo lee.)

5. **Create Static Site**. Cuando termine, la URL es `https://<web>.onrender.com`.

---

## 7. CORS

La API solo acepta pedidos desde los orígenes de `CORS_ORIGINS`.

1. Copiá la URL exacta del Static Site (arriba a la izquierda en Render), por ejemplo
   `https://black-station.onrender.com`.
2. API → **Environment** → `CORS_ORIGINS` = esa URL. Formato:
   - Con `https://`, **sin** `/` al final.
   - Varias separadas por coma: `https://black-station.onrender.com,https://blackstation.com.ar`.
3. **Save, rebuild, and deploy** (o **Save and deploy**).

Síntoma de CORS mal configurado: la web carga pero el catálogo no, y la consola del navegador dice
`blocked by CORS policy`.

---

## 8. Verificación de IP (`TRUST_PROXY`)

Los límites de intentos de login y de pedidos son por IP, así que la API tiene que ver la IP real
del cliente y no la del proxy de Render. `TRUST_PROXY` le dice a Express cuántos proxies hay
delante.

1. En el celular, **con datos móviles** (Wi-Fi apagado), buscá "cuál es mi IP" y anotala.
2. Desde el celular, entrá a `https://<web>.onrender.com/admin/login` y logueate con una
   contraseña **incorrecta** a propósito.
3. API → **Logs**, buscá `[ip]`. Vas a ver algo así:
   ```
   [ip] login fallido: req.ip=181.45.12.34 x-forwarded-for=181.45.12.34
   ```
4. Interpretar:
   - `req.ip` **es** la IP del celular → está bien, dejá `TRUST_PROXY=1`.
   - `req.ip` es otra (una `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x` o la de un proxy) y la IP
     del celular aparece **más a la izquierda** en `x-forwarded-for` → subí `TRUST_PROXY`. El valor
     correcto es **1 + la cantidad de IPs que hay a la derecha de la del celular** en
     `x-forwarded-for`. Ejemplo: `x-forwarded-for=181.45.12.34, 10.0.3.7` → `TRUST_PROXY=2`.
5. Si lo cambiaste, guardá (redeploya) y repetí la prueba.

No pongas un valor más alto que el necesario: con un `TRUST_PROXY` de más, un cliente podría
inventar su IP mandando un `X-Forwarded-For` falso y saltearse los límites.

El log no muestra usuario, contraseña ni teléfono: solo IPs.

---

## 9. UptimeRobot

1. En UptimeRobot (cuenta de la clienta) → **Add New Monitor**:
   - Monitor Type: **HTTP(s)**.
   - Friendly Name: `Black Station API`.
   - URL: `https://<api>.onrender.com/health`.
   - Monitoring Interval: **5 minutes**.
2. **Alert Contacts:** el email de la clienta (viene por defecto) y sumar el de Santiago
   (**My Settings → Alert Contacts → Add**, después tildarlo en el monitor).
3. Guardar y esperar el primer chequeo: tiene que quedar **Up** en verde.

Como `/health` devuelve 503 si se cae la conexión con Mongo, el monitor avisa también si el
problema es la base, no solo la API.

---

## 10. Dominio propio (opcional)

1. **Comprar el dominio** en [NIC Argentina](https://nic.ar) (`.com.ar`), con la clave fiscal de
   la clienta: el titular tiene que ser ella.
2. **DNS:** NIC Argentina no permite cargar registros DNS, solo **delegar** el dominio a los
   servidores de otro proveedor. Opción recomendada, gratis: [Cloudflare](https://cloudflare.com)
   (cuenta de la clienta).
   1. En Cloudflare: **Add a domain** → plan Free. Te da dos nameservers
      (`xxx.ns.cloudflare.com`).
   2. En NIC Argentina: el dominio → **Delegar** → cargar esos dos nameservers. Puede tardar unas
      horas en propagar.
3. **En Render:** Static Site → **Settings → Custom Domains → Add Custom Domain**. Agregar
   `dominio.com.ar` y `www.dominio.com.ar`. Render muestra los registros DNS que hay que crear.
4. **En Cloudflare → DNS → Records:** cargar exactamente los registros que indicó Render, con
   **Proxy status: DNS only** (nube gris). Con la nube naranja Render no puede emitir el
   certificado HTTPS.
5. En Render, **Verify**. Cuando queda verificado, el certificado HTTPS se emite solo.
6. **CORS:** sumar los dos orígenes a `CORS_ORIGINS` de la API:
   ```
   https://<web>.onrender.com,https://dominio.com.ar,https://www.dominio.com.ar
   ```
   y guardar (redeploya).

La API puede seguir en `https://<api>.onrender.com`: no hace falta dominio propio para la API, y
así no hay que tocar `VITE_API_URL`.

---

## 11. Checklist final

Desde un **celular con datos móviles**, en la URL de producción (dominio propio si hay):

- [ ] `https://<api>.onrender.com/health` → `{ "ok": true }`.
- [ ] Login del panel en `/admin/login` con el usuario del seed. Dejar la comanda abierta en una
      compu o tablet.
- [ ] En `/admin/ajustes`, revisar horarios y que los pedidos estén habilitados.
- [ ] La clienta carga al menos una categoría y un producto con foto (prueba Cloudinary).
- [ ] En horario de atención: hacer un pedido real desde el celular (efectivo) → aparece en la
      comanda en ≤ 5 s con el aviso sonoro.
- [ ] Confirmarlo en la comanda → el seguimiento en el celular pasa a confirmado.
- [ ] Marcarlo entregado → el seguimiento lo muestra como entregado.
- [ ] Un pedido con transferencia → muestra el plazo de pago; cancelarlo desde el celular → se
      libera el cupo de la franja.
- [ ] Recargar el celular estando en `/pedido/<codigo>` → carga bien (prueba del Rewrite).
- [ ] Login fallido a propósito → en los logs, `req.ip` es la IP del celular (sección 8).
- [ ] UptimeRobot en **Up**.
- [ ] Avisarle a la clienta cuáles fueron los pedidos de prueba (quedan en el historial del día).

Si algo falla, lo primero es mirar **Logs** de la API en Render y la consola del navegador.
