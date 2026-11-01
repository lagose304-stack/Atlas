# Atlas

## Guía del proyecto y cuidado de producción

Para trabajar en Atlas, comienza por [AGENTS.md](AGENTS.md) y la
[guía de arquitectura, módulos y datos](docs/guia-atlas.md).

Atlas ya está en producción. Algunas secciones de este README conservan instrucciones
históricas: no ejecutes sus scripts SQL ni cambies servicios remotos automáticamente.
El almacenamiento multimedia activo es Cloudflare R2. Comprueba el código actual y el
estado real del entorno antes de preparar cambios que afecten datos existentes.

## Pruebas automatizadas

Ejecuta la suite completa con:

```bash
npm test
```

Durante el desarrollo puedes mantener Vitest observando cambios con `npm run test:watch`.
El workflow de Cloudflare ejecuta las pruebas y `npm run typecheck` antes de compilar y desplegar;
si una comprobacion falla, esa version no se publica.

## Contador publico de visualizaciones

Ejecuta `database/public_site_views_counter.sql` en Supabase antes de desplegar el frontend que usa
el contador publico. La funcion devuelve unicamente el total de visitas y no concede lectura publica
sobre los registros individuales de analitica.

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

### Multimedia y despliegue

R2 es el único almacenamiento multimedia activo. Los nombres históricos de los servicios se conservan por compatibilidad. El workflow de despliegue empaqueta `cloudflare/_worker.js`; cambiar solo `functions/` no actualiza ese Worker.

El frontend usa `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y, opcionalmente, `VITE_R2_PUBLIC_DOMAIN`. Deja `VITE_BACKEND_BASE_URL` vacío para usar las rutas del Worker en producción. Nunca configures un backend de localhost en producción.

El servidor que atiende las operaciones de imágenes necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La clave de servidor nunca lleva `VITE_`, nunca se incorpora al frontend ni se sube a Git. En Pages, configura el binding `R2_BUCKET` y el dominio `R2_PUBLIC_DOMAIN`. Consulta la [guía de Atlas](docs/guia-atlas.md) para el estado verificado y sus límites.

En local, Vite atiende `/api/images-upload`, `/api/images-delete` y `/api/images-move` y también sus rutas `/api/images/*`. Lee `.env` y `backend/.env`. El backend Express es opcional y lee `backend/.env`; requiere las variables R2 indicadas en el archivo de ejemplo, además de las de autorización. `PORT` y `FRONTEND_ORIGINS` son opcionales. Los orígenes locales permitidos incluyen `http://localhost:5173` y `http://127.0.0.1:5173`.

### Auditorías multimedia de solo lectura

- `node scripts/audit-images.mjs`: inventario de referencias y cobertura, sin comprobar disponibilidad de archivos.
- `node scripts/audit-integrity.mjs`: compara referencias, originales y miniaturas con el inventario de R2.
- `node scripts/audit-all-urls.mjs`: comprueba por HTTP HEAD las URLs multimedia del almacenamiento conocido; excluye enlaces externos y de navegación.

Los tres scripts leen las fuentes declaradas de forma paginada, notifican errores y guardan informes locales en `recovered_images/audits/`, excluido de Git. Necesitan la clave de servidor para que los permisos de lectura no oculten filas. La auditoría de integridad requiere también acceso de lectura al bucket R2. Usan consultas de lectura, sin RPC, migraciones, regeneraciones ni borrados automáticos.

Una salida `0` indica comprobación completada sin hallazgos según el alcance del modo; `1` indica hallazgos y `2` auditoría incompleta o configuración incorrecta. Una auditoría de referencias no demuestra existencia de archivos. Las imágenes faltantes del catálogo siguen pendientes y provocan hallazgos de integridad; no son una autorización para eliminarlas. Ver [detalle y comprobaciones](docs/revisiones/mantenimiento-multimedia-2026-10-30.md).
