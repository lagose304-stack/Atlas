-- Preparacion local: no ejecutar sin revisar y autorizar produccion.
-- Requiere add_instructor_image_versus.sql. Permite imagen opcional de R2 (con senalados)
-- en seleccion unica, completacion y terminos pareados, ademas de respuesta breve.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_reference_image(p_question jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_type text := coalesce(p_question->>'type','single_choice');
BEGIN
  IF v_type = 'image_versus' THEN
    IF p_question ? 'image' THEN RAISE EXCEPTION 'El versus de imágenes usa image_a e image_b'; END IF;
    IF p_question ? 'image_a' THEN PERFORM public.atlas_validate_instructor_image_object(p_question->'image_a', true); END IF;
    IF p_question ? 'image_b' THEN PERFORM public.atlas_validate_instructor_image_object(p_question->'image_b', true); END IF;
    RETURN;
  END IF;
  IF (p_question ? 'image_a') OR (p_question ? 'image_b') THEN RAISE EXCEPTION 'Solo el versus de imágenes admite image_a e image_b'; END IF;
  IF NOT (p_question ? 'image') THEN RETURN; END IF;
  IF v_type NOT IN ('single_choice','short_answer','completion','matching','image_point') THEN
    RAISE EXCEPTION 'La imagen debe ser una referencia válida de R2';
  END IF;
  PERFORM public.atlas_validate_instructor_image_object(p_question->'image', v_type <> 'image_point');
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_instructor_public_questions(p_content jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT jsonb_agg(jsonb_build_object('id',q->>'id','titulo',q->>'titulo','type',coalesce(q->>'type','single_choice')) ||
    CASE coalesce(q->>'type','single_choice')
      WHEN 'image_versus' THEN jsonb_build_object(
        'image_a', jsonb_build_object('url',q->'image_a'->>'url') || CASE WHEN q->'image_a' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image_a'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END,
        'image_b', jsonb_build_object('url',q->'image_b'->>'url') || CASE WHEN q->'image_b' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image_b'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END
      )
      WHEN 'image_point' THEN jsonb_build_object('image',jsonb_build_object('url',q->'image'->>'url'))
      WHEN 'short_answer' THEN '{}'::jsonb
      WHEN 'completion' THEN jsonb_build_object('blanks',(
        SELECT jsonb_agg(jsonb_build_object('id',b->>'id') ORDER BY i) FROM jsonb_array_elements(q->'blanks') WITH ORDINALITY x(b,i)))
      WHEN 'matching' THEN jsonb_build_object('terms',(
        SELECT jsonb_agg(jsonb_build_object('id',p->>'id','texto',p->>'term') ORDER BY i) FROM jsonb_array_elements(q->'pairs') WITH ORDINALITY x(p,i)),
        'choices',(SELECT jsonb_agg(jsonb_build_object('id',p->>'option_id','texto',p->>'definition') ORDER BY gen_random_uuid()) FROM jsonb_array_elements(q->'pairs') p))
      ELSE jsonb_build_object('options',(
        SELECT jsonb_agg(jsonb_build_object('id',o->>'id','texto',o->>'texto') ORDER BY i) FROM jsonb_array_elements(q->'options') WITH ORDINALITY x(o,i)))
    END || CASE
      WHEN coalesce(q->>'type','single_choice') IN ('single_choice','short_answer','completion','matching') AND q ? 'image' THEN
        jsonb_build_object('image', jsonb_build_object('url',q->'image'->>'url') || CASE WHEN q->'image' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END)
      ELSE '{}'::jsonb
    END || CASE WHEN parent.group_id IS NOT NULL THEN jsonb_build_object('group', jsonb_build_object('id',parent.group_id,'titulo',parent.group_title,'position',parent.group_position) || CASE WHEN parent.section IS NOT NULL THEN jsonb_build_object('section',parent.section) ELSE '{}'::jsonb END) ELSE '{}'::jsonb END ORDER BY coalesce(parent.group_position,ord), coalesce(parent.item_position,ord))
  FROM jsonb_array_elements(p_content->'questions') WITH ORDINALITY x(q,ord)
  LEFT JOIN LATERAL (
    SELECT (SELECT jsonb_build_object('id',sec->>'id','tema_id',t.id,'nombre',t.nombre,'position',sec_ord) FROM jsonb_array_elements(coalesce(p_content->'sections','[]'::jsonb)) WITH ORDINALITY sx(sec,sec_ord) JOIN public.temas t ON t.id::text=sec->>'tema_id' WHERE sec->>'id'=g->>'section_id') AS section, g->>'id' AS group_id, g->>'titulo' AS group_title, n AS group_position,
      (SELECT i FROM jsonb_array_elements_text(g->'item_ids') WITH ORDINALITY z(item_id,i) WHERE item_id = q->>'id' LIMIT 1) AS item_position
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_content->'groups') = 'array' THEN p_content->'groups' ELSE '[]'::jsonb END) WITH ORDINALITY y(g,n)
    WHERE g->'item_ids' ? (q->>'id') LIMIT 1
  ) parent ON true;
$$;

COMMIT;
