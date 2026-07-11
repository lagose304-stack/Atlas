-- ============================================================
-- Atlas - inicializa snapshots publicados para contenido legado
-- Ejecutar una vez antes de desplegar el nuevo editor visual.
-- No sobrescribe paginas que ya tienen historial de publicacion.
-- ============================================================

BEGIN;

INSERT INTO public.content_page_publications (
  entity_type,
  entity_id,
  status,
  published_blocks,
  published_at
)
SELECT
  grouped.entity_type,
  grouped.entity_id,
  'published',
  grouped.blocks,
  now()
FROM (
  SELECT
    cb.entity_type,
    cb.entity_id,
    jsonb_agg(
      jsonb_build_object(
        'id', cb.id,
        'entity_type', cb.entity_type,
        'entity_id', cb.entity_id,
        'block_type', cb.block_type,
        'sort_order', cb.sort_order,
        'content', cb.content
      ) ORDER BY cb.sort_order
    ) AS blocks
  FROM public.content_blocks cb
  GROUP BY cb.entity_type, cb.entity_id
) AS grouped
ON CONFLICT (entity_type, entity_id) DO NOTHING;

COMMIT;
