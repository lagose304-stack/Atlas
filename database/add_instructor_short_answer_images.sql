-- Preparación local pendiente de autorización.
-- Aplicar DESPUÉS de group_instructor_questions.sql. No cambia tablas ni filas.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.atlas_validate_instructor_groups(jsonb,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Instala primero la actualización de preguntas e incisos';
  END IF;
END; $$;

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
REVOKE ALL ON FUNCTION public.atlas_validate_instructor_reference_image(jsonb) FROM PUBLIC, anon, authenticated;

-- Definiciones completas revisadas a continuación; mantienen firmas y privilegios.

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_content(p_content jsonb, p_publish boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q jsonb; o jsonb; b jsonb; v_type text; v_answers jsonb; v_blanks integer;
BEGIN
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR jsonb_typeof(p_content->'nombre') IS DISTINCT FROM 'string'
     OR length(trim(p_content->>'nombre')) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_content->'instrucciones') IS DISTINCT FROM 'string'
     OR length(p_content->>'instrucciones') > 10000
     OR jsonb_typeof(p_content->'questions') IS DISTINCT FROM 'array'
     OR octet_length(p_content::text) > 500000 THEN RAISE EXCEPTION 'Contenido inválido'; END IF;
  IF jsonb_array_length(p_content->'questions') > 100
     OR (p_publish AND jsonb_array_length(p_content->'questions') = 0) THEN
    RAISE EXCEPTION 'La prueba admite entre 1 y 100 incisos al publicarse';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'questions') x GROUP BY x->>'id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Preguntas repetidas';
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(p_content->'questions') LOOP
    PERFORM public.atlas_validate_instructor_reference_image(q);
    v_type := coalesce(q->>'type','single_choice');
    IF jsonb_typeof(q) <> 'object' OR jsonb_typeof(q->'id') IS DISTINCT FROM 'string'
       OR coalesce(length(q->>'id'),0) NOT BETWEEN 1 AND 80
       OR jsonb_typeof(q->'titulo') IS DISTINCT FROM 'string' OR length(q->>'titulo') > 5000
       OR v_type NOT IN ('single_choice','short_answer','completion','matching') THEN RAISE EXCEPTION 'Pregunta inválida'; END IF;
    IF p_publish AND trim(q->>'titulo') = '' THEN RAISE EXCEPTION 'Completa el enunciado'; END IF;
    IF v_type = 'single_choice' THEN
      IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Opciones inválidas'; END IF;
      IF jsonb_array_length(q->'options') NOT BETWEEN 2 AND 8 THEN RAISE EXCEPTION 'La selección admite de 2 a 8 opciones'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x GROUP BY x->>'id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'Opciones repetidas'; END IF;
      FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
        IF jsonb_typeof(o) <> 'object' OR jsonb_typeof(o->'id') IS DISTINCT FROM 'string'
           OR coalesce(length(o->>'id'),0) NOT BETWEEN 1 AND 80
           OR jsonb_typeof(o->'texto') IS DISTINCT FROM 'string' OR length(o->>'texto') > 3000
           OR (p_publish AND trim(o->>'texto') = '') THEN RAISE EXCEPTION 'Opción inválida'; END IF;
      END LOOP;
      IF p_publish AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE x->>'id' = q->>'correct_option_id') THEN
        RAISE EXCEPTION 'Selecciona una respuesta correcta en cada pregunta';
      END IF;
    ELSIF v_type IN ('short_answer','completion') THEN
      IF v_type = 'completion' THEN
        IF jsonb_typeof(q->'blanks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Huecos inválidos'; END IF;
        v_blanks := jsonb_array_length(q->'blanks');
        IF v_blanks NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'La completación admite de 1 a 12 huecos'; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'blanks') x GROUP BY x->>'id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'Huecos repetidos'; END IF;
        IF p_publish THEN
          IF (SELECT count(*) FROM regexp_matches(q->>'titulo','\{\{([0-9]+)\}\}','g')) <> v_blanks THEN
            RAISE EXCEPTION 'Incluye una vez cada marcador de hueco: {{1}}, {{2}}, etc.';
          END IF;
          FOR v_blanks IN 1..jsonb_array_length(q->'blanks') LOOP
            IF (SELECT count(*) FROM regexp_matches(q->>'titulo','\{\{([0-9]+)\}\}','g') m WHERE m[1] = v_blanks::text) <> 1 THEN
              RAISE EXCEPTION 'Incluye una vez cada marcador de hueco: {{1}}, {{2}}, etc.';
            END IF;
          END LOOP;
        END IF;
      END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(CASE WHEN v_type = 'short_answer'
                    THEN jsonb_build_array(jsonb_build_object('id',q->>'id','accepted_answers',q->'accepted_answers')) ELSE q->'blanks' END) LOOP
        IF jsonb_typeof(b->'id') IS DISTINCT FROM 'string' OR coalesce(length(b->>'id'),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Hueco inválido'; END IF;
        v_answers := b->'accepted_answers';
        IF jsonb_typeof(v_answers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Respuestas aceptadas inválidas'; END IF;
        IF jsonb_array_length(v_answers) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Configura entre 1 y 20 respuestas aceptadas'; END IF;
        FOR o IN SELECT value FROM jsonb_array_elements(v_answers) LOOP
          IF jsonb_typeof(o) <> 'string' OR length(o#>>'{}') > 1000 THEN RAISE EXCEPTION 'Respuesta aceptada inválida'; END IF;
        END LOOP;
        IF p_publish AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_answers) a
                                     WHERE public.atlas_normalize_instructor_answer(a) <> '') THEN
          RAISE EXCEPTION 'Configura una respuesta aceptada para cada pregunta y cada hueco';
        END IF;
      END LOOP;
    ELSE
      IF jsonb_typeof(q->'pairs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Parejas inválidas'; END IF;
      IF jsonb_array_length(q->'pairs') NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Configura entre 2 y 12 parejas'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY p->>'id' HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY p->>'option_id' HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') left_pair, jsonb_array_elements(q->'pairs') right_pair WHERE left_pair->>'id' = right_pair->>'option_id') THEN
        RAISE EXCEPTION 'Los identificadores de términos y opciones deben ser únicos e independientes';
      END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'pairs') LOOP
        IF jsonb_typeof(b) <> 'object' OR jsonb_typeof(b->'id') IS DISTINCT FROM 'string'
           OR coalesce(length(b->>'id'),0) NOT BETWEEN 1 AND 80 OR jsonb_typeof(b->'option_id') IS DISTINCT FROM 'string'
           OR coalesce(length(b->>'option_id'),0) NOT BETWEEN 1 AND 80
           OR jsonb_typeof(b->'term') IS DISTINCT FROM 'string' OR length(b->>'term') > 1000
           OR jsonb_typeof(b->'definition') IS DISTINCT FROM 'string' OR length(b->>'definition') > 1000
           OR (p_publish AND (trim(b->>'term') = '' OR trim(b->>'definition') = '')) THEN RAISE EXCEPTION 'Completa cada término y su pareja'; END IF;
      END LOOP;
      IF p_publish AND (EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY public.atlas_normalize_instructor_answer(p->>'term') HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY public.atlas_normalize_instructor_answer(p->>'definition') HAVING count(*) > 1)) THEN
        RAISE EXCEPTION 'Usa términos y parejas diferentes para evitar respuestas ambiguas';
      END IF;
    END IF;
  END LOOP;
  PERFORM public.atlas_validate_instructor_groups(p_content, p_publish);
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
