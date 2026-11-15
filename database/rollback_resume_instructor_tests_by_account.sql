-- Recuperacion local preparada, requiere autorizacion. Conserva cuentas y progreso.
BEGIN;
CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  q jsonb; b jsonb; v_answer jsonb; v_type text; v_ok boolean;
  v_total integer; v_pending integer := 0; v_submission uuid; v_correct numeric := 0; v_snapshot jsonb; v_auto_results jsonb := '{}'::jsonb; v_result jsonb; v_text text;
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
    IF v_type NOT IN ('short_answer','image_point') THEN v_auto_results := v_auto_results || jsonb_build_object(q->>'id',v_ok); END IF;
    IF v_ok THEN v_correct := v_correct + public.atlas_instructor_inciso_weight(v_snapshot,q->>'id'); END IF;
  END LOOP;
  INSERT INTO public.instructor_test_submissions(test_id, token_hash, test_revision, snapshot, answers, auto_correct, total, manual_count, participant_name, auto_results)
    VALUES(v.id, a.token_hash, v.published_revision,
      v_snapshot,
      p_answers, v_correct, v_total, v_pending, a.participant_name, v_auto_results) RETURNING id INTO v_submission;
  v_result := jsonb_build_object('ok',true,'correct',round(v_correct,8),'total',v_total,'percentage',CASE WHEN v_pending > 0 THEN null ELSE round(100.0*v_correct/v_total,2) END,'pending_review',v_pending,'submission_id',v_submission,'sections',public.atlas_instructor_section_results(v_snapshot,v_auto_results,'{}'::jsonb));
  UPDATE public.instructor_test_access SET result = v_result WHERE token_hash = a.token_hash;
  RETURN v_result;
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
    'auto_results',v.auto_results,'answers',v.answers,'reviews',v.reviews,'revision',v.revision,'created_at',v.created_at,'auto_correct',v.auto_correct,'total',v.total);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_list_instructor_submissions(p_test_id uuid, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN RAISE EXCEPTION 'Pagina invalida'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id) FROM (
    SELECT id, participant_name, created_at, test_revision, total, manual_count - (SELECT count(*)::integer FROM jsonb_object_keys(reviews)) AS pending_review, revision, round(auto_correct+public.atlas_instructor_review_points(snapshot,reviews),8) AS correct,
      CASE WHEN manual_count=(SELECT count(*) FROM jsonb_object_keys(reviews)) THEN round(100.0*(auto_correct+public.atlas_instructor_review_points(snapshot,reviews))/total,2) ELSE null END AS percentage
    FROM public.instructor_test_submissions WHERE test_id=p_test_id ORDER BY created_at DESC,id LIMIT 50 OFFSET p_offset
  ) s), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_begin_instructor_test(uuid,text,text,text),public.atlas_resume_instructor_test(uuid,text,text),public.atlas_save_instructor_progress(uuid,text,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_start_instructor_test(uuid,text,text) TO anon,authenticated;
COMMIT;
