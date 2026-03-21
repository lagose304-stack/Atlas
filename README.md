# Atlas

## Deploy frontend (Cloudflare Pages) + image admin API

### Cloudflare Pages build settings

- Build command: `npm ci --include=dev && npm run build`
- Build output directory: `dist`
- Root directory: `/` (project root)

## Content publishing workflow (draft vs published)

The editor now supports publishing snapshots, so public pages can show only published content while you keep editing drafts.

Run this SQL script in Supabase before using publish buttons:

- `database/setup_content_page_publications.sql`

If this table does not exist yet, the app falls back to reading live draft blocks from `content_blocks`.

## Test system (tests by tema/subtema)

To persist multiple tests classified by topic, run this script in Supabase:

- `database/setup_tests_system.sql`

This creates:

- `tests`: one row per test (linked to `tema_id`, optional `subtema_id`)
- `test_question_blocks`: blocks/questions per test with `block_type`, `config` and `answer_key`

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

Example backend URL value: `https://YOUR_BACKEND_DOMAIN`

### Optional external backend mode

If you still want to use an external backend API instead of Cloudflare Functions, set:

- `VITE_BACKEND_BASE_URL`: public URL of your backend API (no trailing slash)

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