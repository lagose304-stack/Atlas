# Atlas

## Despliegue de seguridad (obligatorio)

La aplicacion usa sesiones propias validadas por PostgreSQL y politicas RLS por rol. Para actualizar
una instalacion existente sin perder usuarios:

1. Ejecuta `database/security_hardening.sql` en el SQL Editor de Supabase.
2. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como secretos de Cloudflare Functions.
3. Configura esas mismas variables en `backend/.env` si utilizas el backend local.
4. Despliega el frontend solamente despues de aplicar la migracion.

La migracion conserva nombres, roles y contrasenas actuales, pero cifra las contrasenas con bcrypt.
Las sesiones antiguas de `localStorage` dejan de ser validas y los usuarios deben iniciar sesion de
nuevo. La service-role key es exclusivamente de servidor y nunca debe tener prefijo `VITE_`.

## Deploy frontend (Cloudflare Pages) + image admin API

### Cloudflare Pages build settings

- Build command: `npm ci --include=dev && npm run build`
- Build output directory: `dist`
- Root directory: `/` (project root)

### Alternative deploy path (recommended if Cloudflare Build Token fails)

If Cloudflare dashboard builds are blocked by a stale build token, deploy from GitHub Actions instead.

Workflow file:

- `.github/workflows/deploy-cloudflare-pages.yml`

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

This bypasses Cloudflare dashboard build tokens and deploys directly with Wrangler on every push to `main`.

## Content publishing workflow (draft vs published)

The editor now supports publishing snapshots, so public pages can show only published content while you keep editing drafts.

Run this SQL script in Supabase before using publish buttons:

- `database/setup_content_page_publications.sql`

If this table does not exist yet, the app falls back to reading live draft blocks from `content_blocks`.

## Test system (pruebas by tema/subtema)

To persist multiple tests classified by topic, run this script in Supabase:

- `database/setup_tests_system.sql`

This creates:

- `pruebas`: one row per test with `nombre`, `instrucciones`, `scope`, `parcial_key`, optional `tema_id` and `subtema_id`
- A future child table for questions can be added later without changing the base `pruebas` table

This project runs in two environments:

- Local dev frontend: http://localhost:5173
- Local dev backend: http://localhost:3001

In production (Cloudflare Pages), image admin actions (delete/move in Cloudinary) run through Cloudflare Functions:

- `/api/images-delete`
- `/api/images-move`

Frontend image admin calls are resolved from `src/services/cloudinary.ts`.

### Cloudflare Pages environment variables

Set these in Cloudflare Pages > Settings > Environment variables:

- `VITE_SUPABASE_URL`: your Supabase URL
- `VITE_SUPABASE_ANON_KEY`: your Supabase anon key
- `VITE_CLOUDINARY_CLOUD_NAME`: your Cloudinary cloud name
- `VITE_CLOUDINARY_UPLOAD_PRESET`: your upload preset

Also required for Cloudflare Functions (server-side secrets, no `VITE_` prefix):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never use a `VITE_` prefix)

Example backend URL value: `https://YOUR_BACKEND_DOMAIN`

### Optional external backend mode

If you still want to use an external backend API instead of Cloudflare Functions, set:

- `VITE_BACKEND_BASE_URL`: public URL of your backend API (no trailing slash)

Important for production:

- Do not set `VITE_BACKEND_BASE_URL` to `localhost` or `127.0.0.1`.
- If you do not have an external backend deployed, leave it empty to use Cloudflare Functions.

Then frontend will call that URL for `/api/images/*`.

### Backend environment variables (only if you deploy backend)

Set these where your backend is deployed:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PORT` (optional)
- `FRONTEND_ORIGINS` (optional extra origins separated by comma)

Current backend CORS already allows:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

Add your production frontend domain through `FRONTEND_ORIGINS`.

### Local .env (frontend)

In local frontend `.env`, keep:

- `VITE_BACKEND_BASE_URL=http://localhost:3001`

### Important

Cloudflare cannot call `localhost` from production.
If you rely only on Cloudflare Functions, you do not need a separate backend deployment for image delete/move.
