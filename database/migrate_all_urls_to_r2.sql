-- ==================================================================================
-- Atlas de Histología — Migración definitiva de URLs a Cloudflare R2
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Actualizar tabla PLACAS
UPDATE public.placas
SET photo_url = regexp_replace(
  photo_url, 
  '^https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?', 
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/'
)
WHERE photo_url LIKE '%res.cloudinary.com%';

-- 2. Actualizar tabla TEMAS
UPDATE public.temas
SET logo_url = regexp_replace(
  logo_url, 
  '^https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?', 
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/'
)
WHERE logo_url LIKE '%res.cloudinary.com%';

-- 3. Actualizar tabla SUBTEMAS
UPDATE public.subtemas
SET logo_url = regexp_replace(
  logo_url, 
  '^https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?', 
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/'
)
WHERE logo_url LIKE '%res.cloudinary.com%';

-- 4. Actualizar tabla PRUEBAS
UPDATE public.pruebas
SET image_url = regexp_replace(
  image_url, 
  '^https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?', 
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/'
)
WHERE image_url LIKE '%res.cloudinary.com%';

-- 5. Actualizar bloques de contenido (content_blocks)
UPDATE public.content_blocks
SET content = regexp_replace(
  content::text,
  'https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?',
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/',
  'g'
)::jsonb
WHERE content::text LIKE '%res.cloudinary.com%';

-- 6. Actualizar versiones de páginas (content_page_versions) si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_page_versions' AND column_name = 'blocks'
  ) THEN
    UPDATE public.content_page_versions
    SET blocks = regexp_replace(
      blocks::text,
      'https://res\.cloudinary\.com/[^/]+/image/upload/(v[0-9]+/)?',
      'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/',
      'g'
    )::jsonb
    WHERE blocks::text LIKE '%res.cloudinary.com%';
  END IF;
END $$;
