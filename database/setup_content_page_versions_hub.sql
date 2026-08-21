-- =====================================================================
--  ATLAS DE HISTOLOGÍA — SISTEMA DE HISTORIAL Y GESTIÓN DE VERSIONES
--  Ejecutar en: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =====================================================================

-- 1. Tabla principal de versiones de página
CREATE TABLE IF NOT EXISTS public.content_page_versions (
  id               BIGSERIAL    PRIMARY KEY,
  entity_type      TEXT         NOT NULL,   -- 'placas_page' | 'subtemas_page' | 'home_page'
  entity_id        INTEGER      NOT NULL,   -- subtema_id o tema_id
  version_name     TEXT         NOT NULL DEFAULT 'Versión 1.0',
  description      TEXT,
  is_published     BOOLEAN      NOT NULL DEFAULT false,
  blocks           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  blocks_count     INTEGER      GENERATED ALWAYS AS (jsonb_array_length(blocks)) STORED,
  created_by       TEXT,
  created_by_name  TEXT,
  updated_by       TEXT,
  updated_by_name  TEXT,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Si la tabla ya existía con UUID, convertimos las columnas a TEXT de forma segura
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_page_versions' AND column_name = 'created_by' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.content_page_versions ALTER COLUMN created_by TYPE TEXT USING created_by::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_page_versions' AND column_name = 'updated_by' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.content_page_versions ALTER COLUMN updated_by TYPE TEXT USING updated_by::text;
  END IF;
END $$;

-- 2. Índices de rendimiento y exclusividad
CREATE INDEX IF NOT EXISTS idx_content_page_versions_entity_order
  ON public.content_page_versions (entity_type, entity_id, is_published DESC, updated_at DESC);

-- Garantiza que solo exista MÁXIMO 1 versión publicada a la vez por página
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_published_version_per_page
  ON public.content_page_versions (entity_type, entity_id)
  WHERE (is_published = true);

-- Seguridad: Impide crear dos versiones con el mismo nombre dentro de una misma página
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_version_name_per_page
  ON public.content_page_versions (entity_type, entity_id, lower(trim(version_name)));

-- 3. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_content_page_versions_updated_at ON public.content_page_versions;
CREATE TRIGGER update_content_page_versions_updated_at
  BEFORE UPDATE ON public.content_page_versions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Políticas RLS
ALTER TABLE public.content_page_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Permitir lectura de content_page_versions" ON public.content_page_versions;
  DROP POLICY IF EXISTS "Permitir insercion de content_page_versions" ON public.content_page_versions;
  DROP POLICY IF EXISTS "Permitir actualizacion de content_page_versions" ON public.content_page_versions;
  DROP POLICY IF EXISTS "Permitir eliminacion de content_page_versions" ON public.content_page_versions;

  CREATE POLICY "Permitir lectura de content_page_versions" ON public.content_page_versions FOR SELECT USING (true);
  CREATE POLICY "Permitir insercion de content_page_versions" ON public.content_page_versions FOR INSERT WITH CHECK (true);
  CREATE POLICY "Permitir actualizacion de content_page_versions" ON public.content_page_versions FOR UPDATE USING (true);
  CREATE POLICY "Permitir eliminacion de content_page_versions" ON public.content_page_versions FOR DELETE USING (true);
END $$;

-- 5. Función RPC atómica para publicar una versión
CREATE OR REPLACE FUNCTION public.publish_page_version(
  p_version_id BIGINT,
  p_user_id TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id INTEGER;
  v_blocks JSONB;
BEGIN
  -- Obtener datos de la versión a publicar
  SELECT entity_type, entity_id, blocks
  INTO v_entity_type, v_entity_id, v_blocks
  FROM public.content_page_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La versión con id % no existe.', p_version_id;
  END IF;

  -- 1. Despublicar todas las demás versiones de esta misma página
  UPDATE public.content_page_versions
  SET is_published = false
  WHERE entity_type = v_entity_type
    AND entity_id = v_entity_id
    AND is_published = true;

  -- 2. Marcar la versión seleccionada como publicada
  UPDATE public.content_page_versions
  SET is_published = true,
      published_at = NOW(),
      updated_at = NOW(),
      updated_by = COALESCE(p_user_id, updated_by),
      updated_by_name = COALESCE(p_user_name, updated_by_name)
  WHERE id = p_version_id;

  -- 3. Sincronizar con content_page_publications para entrega pública inmediata
  INSERT INTO public.content_page_publications (
    entity_type, entity_id, status, published_blocks, published_at, updated_at
  ) VALUES (
    v_entity_type, v_entity_id, 'published', v_blocks, NOW(), NOW()
  )
  ON CONFLICT (entity_type, entity_id)
  DO UPDATE SET
    status = 'published',
    published_blocks = EXCLUDED.published_blocks,
    published_at = EXCLUDED.published_at,
    updated_at = NOW();

  -- 4. Sincronizar también content_blocks (borrador activo base)
  DELETE FROM public.content_blocks
  WHERE entity_type = v_entity_type AND entity_id = v_entity_id;

  INSERT INTO public.content_blocks (id, entity_type, entity_id, block_type, sort_order, content)
  SELECT
    (elem->>'id')::uuid,
    v_entity_type,
    v_entity_id,
    elem->>'block_type',
    (elem->>'sort_order')::integer,
    (elem->'content')::jsonb
  FROM jsonb_array_elements(v_blocks) AS elem;
END;
$$;

-- 6. Migración inicial automática de páginas existentes hacia content_page_versions
INSERT INTO public.content_page_versions (
  entity_type, entity_id, version_name, description, is_published, blocks, created_by_name, updated_by_name, published_at
)
SELECT 
  cb.entity_type,
  cb.entity_id,
  'Versión Inicial (Oficial)' AS version_name,
  'Versión importada automáticamente del contenido existente.' AS description,
  true AS is_published,
  jsonb_agg(
    jsonb_build_object(
      'id', cb.id,
      'entity_type', cb.entity_type,
      'entity_id', cb.entity_id,
      'block_type', cb.block_type,
      'sort_order', cb.sort_order,
      'content', cb.content
    ) ORDER BY cb.sort_order ASC
  ) AS blocks,
  'Sistema' AS created_by_name,
  'Sistema' AS updated_by_name,
  NOW() AS published_at
FROM public.content_blocks cb
GROUP BY cb.entity_type, cb.entity_id
ON CONFLICT DO NOTHING;
