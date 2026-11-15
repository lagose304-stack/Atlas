-- Recuperacion local preparada, requiere autorizacion. Conserva datos y archivos.
BEGIN;
CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_reference_image(p_question jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_image jsonb := p_question->'image';
BEGIN
  IF NOT (p_question ? 'image') THEN RETURN; END IF;
  IF p_question->>'type' IS DISTINCT FROM 'short_answer' OR jsonb_typeof(v_image) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_image->'url') IS DISTINCT FROM 'string' OR length(v_image->>'url') > 2048
     OR v_image->>'url' !~* '^https://pub-49025e2296604f9db7de3c958d1fdd8e\.r2\.dev/[^[:space:]?#]+\.(webp|png|jpe?g|gif)(\?[^[:space:]#]*)?$'
     OR coalesce(v_image->>'source','') NOT IN ('upload','catalog') THEN
    RAISE EXCEPTION 'La imagen debe ser una referencia válida de R2 para respuesta breve';
  END IF;
  IF v_image->>'source' = 'catalog' AND (jsonb_typeof(v_image->'plate_id') IS DISTINCT FROM 'number'
     OR (v_image->>'plate_id') !~ '^[1-9][0-9]*$') THEN RAISE EXCEPTION 'La imagen del catálogo necesita una placa válida'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_instructor_public_questions(p_content jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT jsonb_agg(jsonb_build_object('id',q->>'id','titulo',q->>'titulo','type',coalesce(q->>'type','single_choice')) ||
    CASE coalesce(q->>'type','single_choice')
      WHEN 'short_answer' THEN CASE WHEN q ? 'image' THEN jsonb_build_object('image',jsonb_build_object('url',q->'image'->>'url')) ELSE '{}'::jsonb END
      WHEN 'completion' THEN jsonb_build_object('blanks',(
        SELECT jsonb_agg(jsonb_build_object('id',b->>'id') ORDER BY i) FROM jsonb_array_elements(q->'blanks') WITH ORDINALITY x(b,i)))
      WHEN 'matching' THEN jsonb_build_object('terms',(
        SELECT jsonb_agg(jsonb_build_object('id',p->>'id','texto',p->>'term') ORDER BY i) FROM jsonb_array_elements(q->'pairs') WITH ORDINALITY x(p,i)),
        'choices',(SELECT jsonb_agg(jsonb_build_object('id',p->>'option_id','texto',p->>'definition') ORDER BY gen_random_uuid()) FROM jsonb_array_elements(q->'pairs') p))
      ELSE jsonb_build_object('options',(
        SELECT jsonb_agg(jsonb_build_object('id',o->>'id','texto',o->>'texto') ORDER BY i) FROM jsonb_array_elements(q->'options') WITH ORDINALITY x(o,i)))
    END || CASE WHEN parent.group_id IS NOT NULL THEN jsonb_build_object('group', jsonb_build_object('id',parent.group_id,'titulo',parent.group_title,'position',parent.group_position)) ELSE '{}'::jsonb END ORDER BY coalesce(parent.group_position,ord), coalesce(parent.item_position,ord))
  FROM jsonb_array_elements(p_content->'questions') WITH ORDINALITY x(q,ord)
  LEFT JOIN LATERAL (
    SELECT g->>'id' AS group_id, g->>'titulo' AS group_title, n AS group_position,
      (SELECT i FROM jsonb_array_elements_text(g->'item_ids') WITH ORDINALITY z(item_id,i) WHERE item_id = q->>'id' LIMIT 1) AS item_position
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_content->'groups') = 'array' THEN p_content->'groups' ELSE '[]'::jsonb END) WITH ORDINALITY y(g,n)
    WHERE g->'item_ids' ? (q->>'id') LIMIT 1
  ) parent ON true;
$$;
COMMIT;
