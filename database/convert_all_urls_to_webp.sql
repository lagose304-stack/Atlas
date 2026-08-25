-- ==================================================================================
-- Atlas de Histología — Estandarización de URLs a formato .webp
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Actualizar tabla PLACAS
UPDATE public.placas
SET photo_url = regexp_replace(photo_url, '\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE photo_url ~* '\.(jpe?g|png|bmp|tiff?)$';

-- 2. Actualizar tabla TEMAS
UPDATE public.temas
SET logo_url = regexp_replace(logo_url, '\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE logo_url ~* '\.(jpe?g|png|bmp|tiff?)$';

-- 3. Actualizar tabla SUBTEMAS
UPDATE public.subtemas
SET logo_url = regexp_replace(logo_url, '\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE logo_url ~* '\.(jpe?g|png|bmp|tiff?)$';

-- 4. Actualizar tabla PRUEBAS
UPDATE public.pruebas
SET image_url = regexp_replace(image_url, '\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE image_url ~* '\.(jpe?g|png|bmp|tiff?)$';

-- 5. Actualizar bloques de contenido (content_blocks)
UPDATE public.content_blocks
SET content = regexp_replace(content::text, '\.(jpe?g|png|bmp|tiff?)(["\'']|$)', '.webp\2', 'gi')::jsonb
WHERE content::text ~* '\.(jpe?g|png|bmp|tiff?)(["\'']|$)';

-- 6. Actualizar versiones de páginas (content_page_versions) si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_page_versions' AND column_name = 'blocks'
  ) THEN
    UPDATE public.content_page_versions
    SET blocks = regexp_replace(blocks::text, '\.(jpe?g|png|bmp|tiff?)(["\'']|$)', '.webp\2', 'gi')::jsonb
    WHERE blocks::text ~* '\.(jpe?g|png|bmp|tiff?)(["\'']|$)';
  END IF;
END $$;
