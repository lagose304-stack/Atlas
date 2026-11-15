-- Recuperacion local preparada. Autorizar antes de aplicar; conserva tabla, nombres y respuestas.
BEGIN;
CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  q jsonb; b jsonb; v_answer jsonb; v_type text; v_ok boolean;
  v_total integer; v_pending integer := 0; v_submission uuid; v_correct integer := 0; v_result jsonb; v_text text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND test_id = p_id AND access_version = v.access_version AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','expired'); END IF;
  IF a.result IS NOT NULL THEN RETURN a.result; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 500000 THEN RAISE EXCEPTION 'Respuestas inválidas'; END IF;
  v_total := jsonb_array_length(v.published->'questions');
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
        SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(q->'accepted_answers') s
                       WHERE public.atlas_normalize_instructor_answer(s) = public.atlas_normalize_instructor_answer(v_text)) INTO v_ok;
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
    IF v_ok THEN v_correct := v_correct + 1; END IF;
  END LOOP;
  v_result := jsonb_build_object('ok',true,'correct',v_correct,'total',v_total,'percentage',round(100.0*v_correct/v_total,2));
  IF v_pending > 0 THEN
    INSERT INTO public.instructor_test_submissions(test_id, token_hash, test_revision, snapshot, answers, auto_correct, total, manual_count)
      VALUES(v.id, a.token_hash, v.published_revision,
        jsonb_build_object('nombre',v.published->>'nombre','questions',public.atlas_instructor_public_questions(v.published)),
        p_answers, v_correct, v_total, v_pending) RETURNING id INTO v_submission;
    v_result := jsonb_build_object('ok',true,'correct',v_correct,'total',v_total,'percentage',null,'pending_review',v_pending,'submission_id',v_submission);
  END IF;
  UPDATE public.instructor_test_access SET result = v_result WHERE token_hash = a.token_hash;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_list_instructor_submissions(p_test_id uuid, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN RAISE EXCEPTION 'Pagina invalida'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id) FROM (
    SELECT id, created_at, test_revision, total, manual_count - (SELECT count(*)::integer FROM jsonb_object_keys(reviews)) AS pending_review, revision
    FROM public.instructor_test_submissions WHERE test_id=p_test_id ORDER BY created_at DESC,id LIMIT 50 OFFSET p_offset
  ) s), '[]'::jsonb);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_get_instructor_submission(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_test_submissions%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO v FROM public.instructor_test_submissions WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible'; END IF;
  RETURN jsonb_build_object('id',v.id,'test_id',v.test_id,'test_revision',v.test_revision,'snapshot',v.snapshot,
    'answers',v.answers,'reviews',v.reviews,'revision',v.revision,'created_at',v.created_at,'auto_correct',v.auto_correct,'total',v.total);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_start_instructor_test(uuid,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
