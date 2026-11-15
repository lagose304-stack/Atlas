-- Recuperacion local preparada, requiere autorizacion. Conserva preguntas, secciones, respuestas y columnas.
BEGIN;
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
       OR v_type NOT IN ('single_choice','short_answer','completion','matching','image_point') THEN RAISE EXCEPTION 'Pregunta inválida'; END IF;
    IF p_publish AND trim(q->>'titulo') = '' THEN RAISE EXCEPTION 'Completa el enunciado'; END IF;
    IF v_type = 'image_point' THEN
      IF p_publish AND NOT (q ? 'image') THEN RAISE EXCEPTION 'El inciso de senalado necesita una imagen'; END IF;
    ELSIF v_type = 'single_choice' THEN
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
        IF p_publish AND v_type = 'completion' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_answers) a
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
      WHEN 'image_point' THEN jsonb_build_object('image',jsonb_build_object('url',q->'image'->>'url'))
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
CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  q jsonb; b jsonb; v_answer jsonb; v_type text; v_ok boolean;
  v_total integer; v_pending integer := 0; v_submission uuid; v_correct numeric := 0; v_snapshot jsonb; v_result jsonb; v_text text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND test_id = p_id AND access_version = v.access_version AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','expired'); END IF;
  IF a.result IS NOT NULL THEN RETURN a.result; END IF;
  IF a.participant_name IS NULL THEN RAISE EXCEPTION 'Escribe tu nombre antes de responder'; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 500000 THEN RAISE EXCEPTION 'Respuestas inválidas'; END IF;
  v_snapshot := jsonb_build_object('nombre',v.published->>'nombre','scoring_version',2,'review_guides',(SELECT coalesce(jsonb_object_agg(guide_item->>'id',guide_item->'accepted_answers'),'{}'::jsonb) FROM jsonb_array_elements(v.published->'questions') guide_item WHERE guide_item->>'type'='short_answer'),'questions',public.atlas_instructor_public_questions(v.published));
  SELECT count(DISTINCT coalesce(snapshot_item->'group'->>'id', snapshot_item->>'id')) INTO v_total FROM jsonb_array_elements(v_snapshot->'questions') snapshot_item;
  FOR q IN SELECT value FROM jsonb_array_elements(v.published->'questions') LOOP
    v_type := coalesce(q->>'type','single_choice'); v_answer := p_answers->(q->>'id'); v_ok := true;
    IF v_type IN ('single_choice','short_answer') THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Responde todas las preguntas'; END IF;
      v_text := v_answer#>>'{}';
      IF v_type = 'single_choice' THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id' = v_text) THEN RAISE EXCEPTION 'Responde todas las preguntas'; END IF;
        v_ok := v_text = q->>'correct_option_id';
      ELSE
        IF length(v_text) > 1000 OR public.atlas_normalize_instructor_answer(v_text) = '' THEN RAISE EXCEPTION 'Escribe una respuesta breve'; END IF;
        v_pending := v_pending + 1; v_ok := false;
      END IF;
    ELSIF v_type = 'completion' THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'blanks') LOOP
        IF jsonb_typeof(v_answer->(b->>'id')) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
        v_text := v_answer->>(b->>'id');
        IF length(v_text) > 1000 OR public.atlas_normalize_instructor_answer(v_text) = '' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
        v_ok := v_ok AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(b->'accepted_answers') s
                                WHERE public.atlas_normalize_instructor_answer(s) = public.atlas_normalize_instructor_answer(v_text));
      END LOOP;
    ELSIF v_type = 'matching' THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Relaciona todos los términos'; END IF;
      IF (SELECT count(DISTINCT v_answer->>(p->>'id')) FROM jsonb_array_elements(q->'pairs') p) <> jsonb_array_length(q->'pairs') THEN
        RAISE EXCEPTION 'Relaciona cada término con una opción distinta';
      END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'pairs') LOOP
        IF jsonb_typeof(v_answer->(b->>'id')) IS DISTINCT FROM 'string'
           OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p WHERE p->>'option_id' = v_answer->>(b->>'id')) THEN
          RAISE EXCEPTION 'Relaciona todos los términos con opciones válidas';
        END IF;
        v_ok := v_ok AND v_answer->>(b->>'id') = b->>'option_id';
      END LOOP;
    ELSIF v_type = 'image_point' THEN
      PERFORM public.atlas_validate_instructor_point_answer(v_answer);
      v_pending := v_pending + 1; v_ok := false;
    ELSE RAISE EXCEPTION 'Formato de pregunta no compatible';
    END IF;
    IF v_ok THEN v_correct := v_correct + public.atlas_instructor_inciso_weight(v_snapshot,q->>'id'); END IF;
  END LOOP;
  INSERT INTO public.instructor_test_submissions(test_id, token_hash, test_revision, snapshot, answers, auto_correct, total, manual_count, participant_name)
    VALUES(v.id, a.token_hash, v.published_revision,
      v_snapshot,
      p_answers, v_correct, v_total, v_pending, a.participant_name) RETURNING id INTO v_submission;
  v_result := jsonb_build_object('ok',true,'correct',round(v_correct,8),'total',v_total,'percentage',CASE WHEN v_pending > 0 THEN null ELSE round(100.0*v_correct/v_total,2) END,'pending_review',v_pending,'submission_id',v_submission);
  UPDATE public.instructor_test_access SET result = v_result WHERE token_hash = a.token_hash;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_review_instructor_submission(p_id uuid,p_revision integer,p_reviews jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_test_submissions%ROWTYPE; actor integer; k text; decision jsonb; correct numeric; pending integer;
BEGIN
  actor := public.atlas_require_instructor_manager();
  SELECT * INTO v FROM public.instructor_test_submissions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible'; END IF;
  IF p_revision IS DISTINCT FROM v.revision THEN RAISE EXCEPTION 'Otra persona modifico esta revision. Vuelve a abrirla' USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'object' OR octet_length(p_reviews::text)>20000 THEN RAISE EXCEPTION 'Revision invalida'; END IF;
  FOR k,decision IN SELECT key,value FROM jsonb_each(p_reviews) LOOP
    IF jsonb_typeof(decision) <> 'boolean' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v.snapshot->'questions') q WHERE q->>'id'=k AND public.atlas_instructor_requires_review(v.snapshot,q)) THEN
      RAISE EXCEPTION 'Solo se revisan las respuestas abiertas de esta entrega';
    END IF;
  END LOOP;
  SELECT public.atlas_instructor_review_points(v.snapshot,p_reviews), v.manual_count-count(*) INTO correct,pending FROM jsonb_each(p_reviews);
  UPDATE public.instructor_test_submissions SET reviews=p_reviews, revision=revision+1,reviewed_by=actor,reviewed_at=now() WHERE id=p_id;
  UPDATE public.instructor_test_access SET result=jsonb_build_object('ok',true,'correct',round(v.auto_correct+correct,8),'total',v.total,
    'percentage',CASE WHEN pending>0 THEN null ELSE round(100.0*(v.auto_correct+correct)/v.total,2) END,'pending_review',pending,'submission_id',v.id)
    WHERE token_hash=v.token_hash;
  RETURN public.atlas_get_instructor_submission(p_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_get_instructor_submission(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_test_submissions%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO v FROM public.instructor_test_submissions WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible'; END IF;
  RETURN jsonb_build_object('id',v.id,'participant_name',v.participant_name,'test_id',v.test_id,'test_revision',v.test_revision,'snapshot',v.snapshot,
    'answers',v.answers,'reviews',v.reviews,'revision',v.revision,'created_at',v.created_at,'auto_correct',v.auto_correct,'total',v.total);
END;
$$;
COMMIT;
