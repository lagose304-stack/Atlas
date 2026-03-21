-- =====================================================================
-- Atlas de Histologia - Versionado y rollback de content_blocks
-- Ejecuta este script en el SQL Editor de Supabase
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.content_block_versions (
  id             BIGSERIAL    PRIMARY KEY,
  entity_type    TEXT         NOT NULL,
  entity_id      INTEGER      NOT NULL,
  snapshot_name  TEXT,
  reason         TEXT,
  blocks         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  blocks_count   INTEGER      GENERATED ALWAYS AS (jsonb_array_length(blocks)) STORED,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_block_versions_entity_created
  ON public.content_block_versions (entity_type, entity_id, created_at DESC);

ALTER TABLE public.content_block_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Permitir lectura de content_block_versions" ON public.content_block_versions;
  DROP POLICY IF EXISTS "Permitir insercion de content_block_versions" ON public.content_block_versions;
  DROP POLICY IF EXISTS "Permitir eliminacion de content_block_versions" ON public.content_block_versions;

  CREATE POLICY "Permitir lectura de content_block_versions"
    ON public.content_block_versions FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Permitir insercion de content_block_versions"
    ON public.content_block_versions FOR INSERT
    TO authenticated
    WITH CHECK (true);

  CREATE POLICY "Permitir eliminacion de content_block_versions"
    ON public.content_block_versions FOR DELETE
    TO authenticated
    USING (true);
END
$$;

CREATE OR REPLACE FUNCTION public.save_content_page_version(
  p_entity_type TEXT,
  p_entity_id INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_snapshot_name TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocks JSONB;
  v_version_id BIGINT;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cb.id,
        'entity_type', cb.entity_type,
        'entity_id', cb.entity_id,
        'block_type', cb.block_type,
        'sort_order', cb.sort_order,
        'content', cb.content
      )
      ORDER BY cb.sort_order ASC
    ),
    '[]'::jsonb
  )
  INTO v_blocks
  FROM public.content_blocks cb
  WHERE cb.entity_type = p_entity_type
    AND cb.entity_id = p_entity_id;

  INSERT INTO public.content_block_versions (
    entity_type,
    entity_id,
    snapshot_name,
    reason,
    blocks
  ) VALUES (
    p_entity_type,
    p_entity_id,
    NULLIF(trim(p_snapshot_name), ''),
    NULLIF(trim(p_reason), ''),
    v_blocks
  )
  RETURNING id INTO v_version_id;

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_content_page_version(
  p_version_id BIGINT,
  p_replace BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version RECORD;
  v_restored_count INTEGER;
BEGIN
  SELECT id, entity_type, entity_id, blocks
  INTO v_version
  FROM public.content_block_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la version de contenido con id=%', p_version_id;
  END IF;

  IF p_replace THEN
    DELETE FROM public.content_blocks
    WHERE entity_type = v_version.entity_type
      AND entity_id = v_version.entity_id;
  END IF;

  INSERT INTO public.content_blocks (id, entity_type, entity_id, block_type, sort_order, content)
  SELECT
    COALESCE((j.item->>'id')::uuid, gen_random_uuid()),
    COALESCE(j.item->>'entity_type', v_version.entity_type),
    COALESCE((j.item->>'entity_id')::integer, v_version.entity_id),
    COALESCE(j.item->>'block_type', 'paragraph'),
    COALESCE((j.item->>'sort_order')::integer, 0),
    COALESCE(j.item->'content', '{}'::jsonb)
  FROM jsonb_array_elements(v_version.blocks) AS j(item)
  ON CONFLICT (id) DO UPDATE
  SET
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    block_type = EXCLUDED.block_type,
    sort_order = EXCLUDED.sort_order,
    content = EXCLUDED.content,
    updated_at = now();

  GET DIAGNOSTICS v_restored_count = ROW_COUNT;

  -- Si existe el sistema de publicaciones, restaura a draft para evitar
  -- desalineacion entre editor (draft) y vista publica (published snapshot).
  IF to_regclass('public.content_page_publications') IS NOT NULL THEN
    INSERT INTO public.content_page_publications (entity_type, entity_id, status)
    VALUES (v_version.entity_type, v_version.entity_id, 'draft')
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      status = 'draft',
      updated_at = now();
  END IF;

  RETURN v_restored_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_content_page_version(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_content_page_version(BIGINT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_content_page_version(TEXT, INTEGER, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_content_page_version(BIGINT, BOOLEAN) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_content_page_version(TEXT, INTEGER, TEXT, TEXT)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.restore_content_page_version(BIGINT, BOOLEAN)
  TO authenticated, service_role;
