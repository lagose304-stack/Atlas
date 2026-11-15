-- Preparacion local: requiere section_instructor_tests_by_topic.sql. Autorizar antes de aplicar.
BEGIN;
ALTER TABLE public.instructor_test_access ADD COLUMN account_number text CHECK(account_number ~ '^[0-9]{10,13}$'), ADD COLUMN progress_id uuid;
ALTER TABLE public.instructor_test_submissions ADD COLUMN account_number text CHECK(account_number ~ '^[0-9]{10,13}$');
ALTER TABLE public.instructor_test_attempts ADD COLUMN recovery_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN recovery_window_start timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.instructor_test_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.instructor_tests(id),
  test_revision integer NOT NULL,
  account_number text NOT NULL CHECK(account_number ~ '^[0-9]{10,13}$'),
  participant_name text NOT NULL CHECK(length(participant_name) BETWEEN 1 AND 150),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_question_id text,
  revision integer NOT NULL DEFAULT 1,
  active_token_hash text NOT NULL,
  submission_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_id,test_revision,account_number)
);
ALTER TABLE public.instructor_test_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_test_progress FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.atlas_require_instructor_access(p_id uuid,p_token text)
RETURNS public.instructor_test_access LANGUAGE plpgsql SET search_path=public,extensions AS $$
DECLARE t public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id AND estado='publicada' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La prueba ya no esta publicada'; END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE test_id=p_id AND token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND access_version=t.access_version AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tu acceso caduco. Introduce de nuevo el codigo'; END IF;
  RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_require_instructor_access(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.atlas_begin_instructor_test(p_id uuid,p_token text,p_name text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE; n text;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF a.result IS NOT NULL THEN RAISE EXCEPTION 'Esta prueba ya fue entregada'; END IF;
  IF p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'El numero de cuenta debe tener entre 10 y 13 digitos'; END IF;
  n:=trim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'));
  IF length(n) NOT BETWEEN 1 AND 150 OR n ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Escribe un nombre valido de hasta 150 caracteres'; END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  INSERT INTO public.instructor_test_progress(test_id,test_revision,account_number,participant_name,active_token_hash)
    VALUES(p_id,t.published_revision,p_account,n,a.token_hash) ON CONFLICT(test_id,test_revision,account_number) DO NOTHING;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND test_revision=t.published_revision AND account_number=p_account FOR UPDATE;
  IF p.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta version de la prueba'; END IF;
  IF p.active_token_hash <> a.token_hash OR p.participant_name <> n OR (a.progress_id IS NOT NULL AND a.progress_id <> p.id) THEN
    RAISE EXCEPTION 'Ya hay una prueba iniciada. Usa Continuar prueba para recuperarla';
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  RETURN jsonb_build_object('ok',true,'participant_name',p.participant_name,'account_number',p.account_number,'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision);
END;
$$;

CREATE FUNCTION public.atlas_resume_instructor_test(p_id uuid,p_token text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE;
  attempts public.instructor_test_attempts%ROWTYPE; client text;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'El numero de cuenta debe tener entre 10 y 13 digitos'; END IF;
  client:=encode(digest(coalesce(nullif(trim(split_part(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''),',',1)),''),'unknown'),'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES(p_id,client) ON CONFLICT DO NOTHING;
  SELECT * INTO attempts FROM public.instructor_test_attempts WHERE test_id=p_id AND client_hash=client FOR UPDATE;
  IF attempts.recovery_window_start<=now()-interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET recovery_failures=0,recovery_window_start=now() WHERE test_id=p_id AND client_hash=client;
    attempts.recovery_failures:=0;
  END IF;
  IF attempts.recovery_failures>=5 THEN RETURN jsonb_build_object('ok',false,'status','locked'); END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND test_revision=t.published_revision AND account_number=p_account FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.instructor_test_attempts SET recovery_failures=recovery_failures+1 WHERE test_id=p_id AND client_hash=client;
    RETURN jsonb_build_object('ok',false,'status','not_found');
  END IF;
  IF p.submission_id IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'status','submitted'); END IF;
  IF a.result IS NOT NULL OR (a.progress_id IS NOT NULL AND a.progress_id<>p.id) THEN RAISE EXCEPTION 'Este acceso ya pertenece a otro intento'; END IF;
  IF p.active_token_hash<>a.token_hash THEN
    UPDATE public.instructor_test_progress SET active_token_hash=a.token_hash,revision=revision+1,updated_at=now() WHERE id=p.id RETURNING * INTO p;
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  UPDATE public.instructor_test_attempts SET recovery_failures=0 WHERE test_id=p_id AND client_hash=client;
  RETURN jsonb_build_object('ok',true,'participant_name',p.participant_name,'account_number',p.account_number,'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision);
END;
$$;

CREATE FUNCTION public.atlas_save_instructor_progress(p_id uuid,p_token text,p_revision integer,p_answers jsonb,p_current_question_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; p public.instructor_test_progress%ROWTYPE; t public.instructor_tests%ROWTYPE;
  q jsonb; v jsonb; k text; item jsonb;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  SELECT * INTO p FROM public.instructor_test_progress WHERE id=a.progress_id FOR UPDATE;
  IF NOT FOUND OR p.active_token_hash<>a.token_hash THEN RAISE EXCEPTION 'El intento se abrio en otra sesion. Recuperalo de nuevo para continuar'; END IF;
  IF p.submission_id IS NOT NULL OR a.result IS NOT NULL THEN RAISE EXCEPTION 'La prueba ya fue entregada'; END IF;
  IF p_revision IS DISTINCT FROM p.revision THEN
    IF p_revision+1=p.revision AND p_answers=p.answers AND p_current_question_id IS NOT DISTINCT FROM p.current_question_id THEN
      RETURN jsonb_build_object('ok',true,'progress_revision',p.revision);
    END IF;
    RAISE EXCEPTION 'El progreso cambio en otra sesion. Recupera de nuevo la prueba' USING ERRCODE='40001';
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text)>500000 THEN RAISE EXCEPTION 'Progreso invalido'; END IF;
  IF p_current_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.atlas_instructor_public_questions(t.published)) x WHERE coalesce(x->'group'->>'id','legacy-'||(x->>'id'))=p_current_question_id) THEN RAISE EXCEPTION 'Pregunta de progreso invalida'; END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_answers) LOOP
    SELECT value INTO q FROM jsonb_array_elements(t.published->'questions') WHERE value->>'id'=k;
    IF NOT FOUND THEN RAISE EXCEPTION 'Respuesta ajena a esta prueba'; END IF;
    IF coalesce(q->>'type','single_choice') IN ('single_choice','short_answer') OR v='""'::jsonb THEN
      IF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>1000 THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
      IF coalesce(q->>'type','single_choice')='single_choice' AND v<>'""'::jsonb AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE x->>'id'=v#>>'{}') THEN RAISE EXCEPTION 'Opcion de progreso invalida'; END IF;
    ELSIF q->>'type'='image_point' THEN PERFORM public.atlas_validate_instructor_point_answer(v);
    ELSE
      IF jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
      FOR k,item IN SELECT key,value FROM jsonb_each(v) LOOP
        IF jsonb_typeof(item)<>'string' OR length(item#>>'{}')>1000 THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
        IF q->>'type'='completion' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'blanks') x WHERE x->>'id'=k) THEN RAISE EXCEPTION 'Hueco ajeno a esta prueba'; END IF;
        IF q->>'type'='matching' AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'pairs') x WHERE x->>'id'=k) OR (item<>'""'::jsonb AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'pairs') x WHERE x->>'option_id'=item#>>'{}'))) THEN RAISE EXCEPTION 'Pareja ajena a esta prueba'; END IF;
      END LOOP;
    END IF;
  END LOOP;
  UPDATE public.instructor_test_progress SET answers=p_answers,current_question_id=p_current_question_id,revision=revision+1,updated_at=now() WHERE id=p.id RETURNING * INTO p;
  RETURN jsonb_build_object('ok',true,'progress_revision',p.revision);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_start_instructor_test(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.atlas_begin_instructor_test(uuid,text,text,text),public.atlas_resume_instructor_test(uuid,text,text),public.atlas_save_instructor_progress(uuid,text,integer,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_begin_instructor_test(uuid,text,text,text),public.atlas_resume_instructor_test(uuid,text,text),public.atlas_save_instructor_progress(uuid,text,integer,jsonb,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_progress public.instructor_test_progress%ROWTYPE; v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  q jsonb; b jsonb; v_answer jsonb; v_type text; v_ok boolean;
  v_total integer; v_pending integer := 0; v_submission uuid; v_correct numeric := 0; v_snapshot jsonb; v_auto_results jsonb := '{}'::jsonb; v_result jsonb; v_text text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND test_id = p_id AND access_version = v.access_version AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','expired'); END IF;
  IF a.result IS NOT NULL THEN RETURN a.result; END IF;
  SELECT * INTO v_progress FROM public.instructor_test_progress WHERE id=a.progress_id FOR UPDATE;
  IF NOT FOUND OR v_progress.active_token_hash<>a.token_hash OR a.account_number IS NULL THEN RAISE EXCEPTION 'Registra tu cuenta o recupera de nuevo la prueba antes de entregar'; END IF;
  IF v_progress.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta version de la prueba'; END IF;
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
  INSERT INTO public.instructor_test_submissions(test_id, token_hash, test_revision, snapshot, answers, auto_correct, total, manual_count, participant_name, auto_results, account_number)
    VALUES(v.id, a.token_hash, v.published_revision,
      v_snapshot,
      p_answers, v_correct, v_total, v_pending, a.participant_name, v_auto_results, a.account_number) RETURNING id INTO v_submission;
  v_result := jsonb_build_object('ok',true,'correct',round(v_correct,8),'total',v_total,'percentage',CASE WHEN v_pending > 0 THEN null ELSE round(100.0*v_correct/v_total,2) END,'pending_review',v_pending,'submission_id',v_submission,'sections',public.atlas_instructor_section_results(v_snapshot,v_auto_results,'{}'::jsonb));
  UPDATE public.instructor_test_progress SET submission_id=v_submission,answers='{}'::jsonb,updated_at=now(),revision=revision+1 WHERE id=v_progress.id;
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
  RETURN jsonb_build_object('id',v.id,'participant_name',v.participant_name,'account_number',v.account_number,'test_id',v.test_id,'test_revision',v.test_revision,'snapshot',v.snapshot,
    'auto_results',v.auto_results,'answers',v.answers,'reviews',v.reviews,'revision',v.revision,'created_at',v.created_at,'auto_correct',v.auto_correct,'total',v.total);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_list_instructor_submissions(p_test_id uuid, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN RAISE EXCEPTION 'Pagina invalida'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id) FROM (
    SELECT id, account_number, participant_name, created_at, test_revision, total, manual_count - (SELECT count(*)::integer FROM jsonb_object_keys(reviews)) AS pending_review, revision, round(auto_correct+public.atlas_instructor_review_points(snapshot,reviews),8) AS correct,
      CASE WHEN manual_count=(SELECT count(*) FROM jsonb_object_keys(reviews)) THEN round(100.0*(auto_correct+public.atlas_instructor_review_points(snapshot,reviews))/total,2) ELSE null END AS percentage
    FROM public.instructor_test_submissions WHERE test_id=p_test_id ORDER BY created_at DESC,id LIMIT 50 OFFSET p_offset
  ) s), '[]'::jsonb);
END;
$$;
COMMIT;
