-- ==================================================================================
-- Atlas de Histología — Migración de URLs en placas_sin_clasificar a Cloudflare R2
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Actualizar las URLs de Cloudinary a Cloudflare R2 normalizando placas_sin_clasificar a placas/sin_clasificar
UPDATE public.placas_sin_clasificar
SET photo_url = replace(
  regexp_replace(
    photo_url, 
    '^https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?', 
    'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/'
  ),
  'placas_sin_clasificar',
  'placas/sin_clasificar'
)
WHERE photo_url LIKE '%res.cloudinary.com%' OR photo_url LIKE '%placas_sin_clasificar%';

-- 2. Asegurar que las URLs de R2 tengan el prefijo placas/sin_clasificar/ si les falta
UPDATE public.placas_sin_clasificar
SET photo_url = replace(photo_url, 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/', 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/sin_clasificar/')
WHERE photo_url LIKE 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/%'
  AND photo_url NOT LIKE '%/placas/%'
  AND photo_url NOT LIKE '%/temas/%'
  AND photo_url NOT LIKE '%/pruebas/%'
  AND photo_url NOT LIKE '%/creditos/%';

-- 3. Asegurar extensión .webp
UPDATE public.placas_sin_clasificar
SET photo_url = regexp_replace(photo_url, '\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE photo_url ~* '\.(jpe?g|png|bmp|tiff?)$';

-- 4. Si no tiene extensión, agregar .webp
UPDATE public.placas_sin_clasificar
SET photo_url = photo_url || '.webp'
WHERE photo_url NOT LIKE '%.webp' AND photo_url NOT LIKE '%.png' AND photo_url NOT LIKE '%.jpg' AND photo_url NOT LIKE '%.jpeg';


