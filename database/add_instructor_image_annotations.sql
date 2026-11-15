-- Preparacion local. Requiere autorizacion antes de aplicarse en Supabase.
-- Aplicar despues de add_instructor_short_answer_images.sql. Sin cambios de tablas o filas.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.atlas_validate_instructor_reference_image(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Instala primero las imagenes de respuesta breve';
  END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_polygon(p_points jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF jsonb_typeof(p_points) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Borde de senalado invalido'; END IF;
  IF jsonb_array_length(p_points) NOT BETWEEN 6 AND 2000 OR jsonb_array_length(p_points) % 2 <> 0 THEN RAISE EXCEPTION 'Borde de senalado invalido'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_points) LOOP
    IF jsonb_typeof(v) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Borde de senalado invalido'; END IF;
    IF v::text::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Borde de senalado fuera de imagen'; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_validate_instructor_polygon(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_reference_image(p_question jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_image jsonb := p_question->'image'; a jsonb; v_key text; v_polygon jsonb;
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
  IF NOT (v_image ? 'annotations') THEN RETURN; END IF;
  IF jsonb_typeof(v_image->'annotations') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lista de senalados invalida'; END IF;
  IF jsonb_array_length(v_image->'annotations') > 100 THEN RAISE EXCEPTION 'Maximo 100 senalados por imagen'; END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(v_image->'annotations') LOOP
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR jsonb_typeof(a->'label') IS DISTINCT FROM 'string'
      OR length(trim(a->>'label')) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Nombre de senalado invalido'; END IF;
    FOREACH v_key IN ARRAY ARRAY['x','y'] LOOP
      IF jsonb_typeof(a->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Coordenadas de senalado invalidas'; END IF;
      IF (a->>v_key)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Coordenadas de senalado fuera de imagen'; END IF;
    END LOOP;
    IF (a->>'startX' IS NULL) IS DISTINCT FROM (a->>'startY' IS NULL) THEN RAISE EXCEPTION 'Origen de aguja incompleto'; END IF;
    FOREACH v_key IN ARRAY ARRAY['startX','startY','regionOpacity','regionStrokeWidth','regionDashLength','regionDashGap'] LOOP
      IF a->>v_key IS NOT NULL THEN
        IF jsonb_typeof(a->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Estilo de senalado invalido'; END IF;
        IF (a->>v_key)::numeric < 0 OR (a->>v_key)::numeric > (CASE WHEN v_key IN ('startX','startY','regionOpacity') THEN 1 ELSE 100 END) THEN RAISE EXCEPTION 'Estilo de senalado fuera de rango'; END IF;
      END IF;
    END LOOP;
    IF a->>'regionColor' IS NOT NULL AND (a->>'regionColor' !~ '^#[0-9A-Fa-f]{6}$') THEN RAISE EXCEPTION 'Color de senalado invalido'; END IF;
    IF a->>'regionSmooth' IS NOT NULL AND jsonb_typeof(a->'regionSmooth') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Suavizado de senalado invalido'; END IF;
    IF a->>'regionPoints' IS NOT NULL THEN PERFORM public.atlas_validate_instructor_polygon(a->'regionPoints'); END IF;
    IF a->>'regionHoles' IS NOT NULL THEN
      IF a->>'regionPoints' IS NULL OR jsonb_typeof(a->'regionHoles') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Exclusiones de senalado invalidas'; END IF;
      IF jsonb_array_length(a->'regionHoles') > 20 THEN RAISE EXCEPTION 'Demasiadas exclusiones de senalado'; END IF;
      FOR v_polygon IN SELECT value FROM jsonb_array_elements(a->'regionHoles') LOOP
        PERFORM public.atlas_validate_instructor_polygon(v_polygon);
      END LOOP;
    END IF;
  END LOOP;

END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_instructor_public_questions(p_content jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT jsonb_agg(jsonb_build_object('id',q->>'id','titulo',q->>'titulo','type',coalesce(q->>'type','single_choice')) ||
    CASE coalesce(q->>'type','single_choice')
      WHEN 'short_answer' THEN CASE WHEN q ? 'image' THEN jsonb_build_object('image',jsonb_build_object('url',q->'image'->>'url') || CASE WHEN q->'image' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END) ELSE '{}'::jsonb END
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
