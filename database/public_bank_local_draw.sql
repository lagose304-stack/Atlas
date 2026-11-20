-- Instalar después del banco público. Solo expone material de pruebas publicadas.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_get_public_bank_pool(p_prueba_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'test', jsonb_build_object(
      'id', t.id, 'nombre', t.nombre, 'instrucciones', t.instrucciones,
      'scope', t.scope, 'parcial_key', t.parcial_key, 'tema_id', t.tema_id,
      'created_at', t.created_at, 'estado', t.estado, 'mode', t.mode
    ),
    'config', t.bank_config,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'sort_order', o.sort_order,
        'titulo', o.titulo,
        'required', TRUE,
        'subtema_id', o.subtema_id,
        'reference_photo_url', o.reference_photo_url,
        'reference_tema_name', o.reference_tema_name,
        'reference_subtema_name', o.reference_subtema_name,
        'reference_senalado', o.reference_senalado,
        'reference_senalado_x', CASE WHEN o.reference_senalado IS NOT NULL THEN (o.reference_senalado->>'x')::numeric ELSE NULL END,
        'reference_senalado_y', CASE WHEN o.reference_senalado IS NOT NULL THEN (o.reference_senalado->>'y')::numeric ELSE NULL END,
        'reference_senalado_start_x', CASE WHEN o.reference_senalado IS NOT NULL AND o.reference_senalado ? 'startX' THEN (o.reference_senalado->>'startX')::numeric ELSE NULL END,
        'reference_senalado_start_y', CASE WHEN o.reference_senalado IS NOT NULL AND o.reference_senalado ? 'startY' THEN (o.reference_senalado->>'startY')::numeric ELSE NULL END,
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', opt.elem->>'id',
            'pregunta_id', o.id,
            'sort_order', opt.opt_order,
            'texto', opt.elem->>'texto'
          ) ORDER BY opt.opt_order)
          FROM (
            SELECT
              elem,
              (row_number() OVER (
                ORDER BY (elem->>'sort_order')::integer, elem->>'id'
              ) - 1)::integer AS opt_order
            FROM jsonb_array_elements(o.options) elem
          ) opt
        ), '[]'::jsonb)
      ) ORDER BY o.subtema_id NULLS FIRST, o.sort_order, o.id)
      FROM public.public_bank_questions o
      WHERE o.tema_id = t.tema_id
        AND CASE WHEN o.subtema_id IS NULL
          THEN (t.bank_config->>'general_count')::integer
          ELSE (t.bank_config->'subtema_counts'->>o.subtema_id::text)::integer
        END > 0
    ), '[]'::jsonb)
  )
  FROM public.pruebas t
  WHERE t.id = p_prueba_id AND t.mode = 'bank' AND t.estado = 'publicada';
$$;

REVOKE ALL ON FUNCTION public.atlas_get_public_bank_pool(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_get_public_bank_pool(UUID) TO anon, authenticated;

COMMIT;
