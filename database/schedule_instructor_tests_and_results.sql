-- Preparacion local. Requiere resume_instructor_tests_by_account.sql. Autorizar antes de aplicar.
BEGIN;
ALTER TABLE public.instructor_tests ADD COLUMN attempt_revision integer;
ALTER TABLE public.instructor_test_attempts ADD COLUMN result_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN result_window_start timestamptz NOT NULL DEFAULT now();
CREATE INDEX instructor_submissions_account_lookup ON public.instructor_test_submissions(test_id,account_number,created_at DESC,id DESC) WHERE account_number IS NOT NULL;
CREATE FUNCTION public.atlas_validate_instructor_schedule(p_content jsonb,p_publish boolean)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb:=p_content->'schedule'; opening timestamptz; closing timestamptz;
BEGIN
  IF NOT(p_content ? 'schedule') THEN RETURN; END IF;
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s->'opens_at') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'closes_at') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Horario invalido'; END IF;
  IF NOT p_publish AND (s->>'opens_at'='' OR s->>'closes_at'='') THEN RETURN; END IF;
  IF length(s->>'opens_at')>50 OR length(s->>'closes_at')>50 OR s->>'opens_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' OR s->>'closes_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Horario invalido: incluye fechas y zona horaria'; END IF;
  BEGIN opening:=(s->>'opens_at')::timestamptz;closing:=(s->>'closes_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Fechas del horario invalidas'; END;
  IF closing<=opening THEN RAISE EXCEPTION 'El cierre debe ser posterior a la apertura'; END IF;
END;
$$;
CREATE FUNCTION public.atlas_instructor_schedule_status(p_content jsonb)
RETURNS text LANGUAGE sql VOLATILE SET search_path=public AS $$
  SELECT CASE WHEN NOT(p_content ? 'schedule') THEN 'open'
    WHEN clock_timestamp()<(p_content#>>'{schedule,opens_at}')::timestamptz THEN 'scheduled'
    WHEN clock_timestamp()>=(p_content#>>'{schedule,closes_at}')::timestamptz THEN 'closed' ELSE 'open' END;
$$;
REVOKE ALL ON FUNCTION public.atlas_validate_instructor_schedule(jsonb,boolean),public.atlas_instructor_schedule_status(jsonb) FROM PUBLIC,anon,authenticated;

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
  PERFORM public.atlas_validate_instructor_sections(p_content,p_publish);
  PERFORM public.atlas_validate_instructor_schedule(p_content,p_publish);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_public_instructor_tests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT id, now() AS server_time, published#>>'{schedule,opens_at}' AS opens_at, published#>>'{schedule,closes_at}' AS closes_at, public.atlas_instructor_schedule_status(published) AS availability, published->>'nombre' AS nombre, published->>'instrucciones' AS instrucciones,
      CASE WHEN jsonb_typeof(published->'groups') = 'array' THEN jsonb_array_length(published->'groups') ELSE jsonb_array_length(published->'questions') END AS question_count,
      CASE WHEN jsonb_typeof(published->'groups') = 'array' THEN jsonb_array_length(published->'questions') ELSE NULL END AS inciso_count
    FROM public.instructor_tests WHERE estado = 'publicada' ORDER BY created_at, id LIMIT 100
  ) x;
$$;
CREATE OR REPLACE FUNCTION public.atlas_unlock_instructor_test(p_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_attempts%ROWTYPE;
  v_client text; v_token text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  IF public.atlas_instructor_schedule_status(v.published)<>'open' THEN RETURN jsonb_build_object('ok',false,'status','outside_schedule'); END IF;
  v_client := encode(digest(coalesce(nullif(trim(split_part(
    coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''), ',', 1)),''),
    'unknown'), 'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES (p_id,v_client) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT a FROM public.instructor_test_attempts WHERE test_id = p_id AND client_hash = v_client FOR UPDATE;
  IF a.window_start <= now() - interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET failures = 0, window_start = now() WHERE test_id = p_id AND client_hash = v_client;
    a.failures := 0;
  END IF;
  IF a.failures >= 5 THEN RETURN jsonb_build_object('ok',false,'status','locked'); END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR crypt(p_code, v.code_hash) IS DISTINCT FROM v.code_hash THEN
    UPDATE public.instructor_test_attempts SET failures = failures + 1 WHERE test_id = p_id AND client_hash = v_client;
    RETURN jsonb_build_object('ok',false,'status','invalid_code');
  END IF;
  UPDATE public.instructor_test_attempts SET failures = 0 WHERE test_id = p_id AND client_hash = v_client;
  v_token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.instructor_test_access(token_hash,test_id,access_version,expires_at)
    VALUES (encode(digest(v_token,'sha256'),'hex'),p_id,v.access_version,now()+interval '2 hours');
  RETURN jsonb_build_object('ok',true,'token',v_token,'test',jsonb_build_object('nombre',v.published->>'nombre',
    'instrucciones',v.published->>'instrucciones','questions',public.atlas_instructor_public_questions(v.published)));
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_begin_instructor_test(p_id uuid,p_token text,p_name text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE; n text;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF (SELECT public.atlas_instructor_schedule_status(published) FROM public.instructor_tests WHERE id=p_id)<>'open' THEN RAISE EXCEPTION 'La prueba esta fuera de horario'; END IF;
  IF a.result IS NOT NULL THEN RAISE EXCEPTION 'Esta prueba ya fue entregada'; END IF;
  IF p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'El numero de cuenta debe tener entre 10 y 13 digitos'; END IF;
  n:=trim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'));
  IF length(n) NOT BETWEEN 1 AND 150 OR n ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Escribe un nombre valido de hasta 150 caracteres'; END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  INSERT INTO public.instructor_test_progress(test_id,test_revision,account_number,participant_name,active_token_hash)
    VALUES(p_id,coalesce(t.attempt_revision,t.published_revision),p_account,n,a.token_hash) ON CONFLICT(test_id,test_revision,account_number) DO NOTHING;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND test_revision=coalesce(t.attempt_revision,t.published_revision) AND account_number=p_account FOR UPDATE;
  IF p.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta version de la prueba'; END IF;
  IF p.active_token_hash <> a.token_hash OR p.participant_name <> n OR (a.progress_id IS NOT NULL AND a.progress_id <> p.id) THEN
    RAISE EXCEPTION 'Ya hay una prueba iniciada. Usa Continuar prueba para recuperarla';
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  RETURN jsonb_build_object('ok',true,'participant_name',p.participant_name,'account_number',p.account_number,'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_resume_instructor_test(p_id uuid,p_token text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE;
  attempts public.instructor_test_attempts%ROWTYPE; client text;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF (SELECT public.atlas_instructor_schedule_status(published) FROM public.instructor_tests WHERE id=p_id)<>'open' THEN RAISE EXCEPTION 'La prueba esta fuera de horario'; END IF;
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
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND test_revision=coalesce(t.attempt_revision,t.published_revision) AND account_number=p_account FOR UPDATE;
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
CREATE FUNCTION public.atlas_instructor_participant_result(p_id uuid,p_code text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE t public.instructor_tests%ROWTYPE; s public.instructor_test_submissions%ROWTYPE;
  attempts public.instructor_test_attempts%ROWTYPE; client text; correct numeric; result jsonb;
BEGIN
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  client:=encode(digest(coalesce(nullif(trim(split_part(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''),',',1)),''),'unknown'),'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES(p_id,client) ON CONFLICT DO NOTHING;
  SELECT * INTO attempts FROM public.instructor_test_attempts WHERE test_id=p_id AND client_hash=client FOR UPDATE;
  IF attempts.result_window_start<=now()-interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET result_failures=0,result_window_start=now() WHERE test_id=p_id AND client_hash=client;
    attempts.result_failures:=0;
  END IF;
  IF attempts.result_failures>=5 THEN RETURN jsonb_build_object('ok',false,'status','locked'); END IF;
  IF t.code_hash IS NULL OR p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR crypt(p_code,t.code_hash) IS DISTINCT FROM t.code_hash OR p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN
    UPDATE public.instructor_test_attempts SET result_failures=result_failures+1 WHERE test_id=p_id AND client_hash=client;
    RETURN jsonb_build_object('ok',false,'status','unavailable');
  END IF;
  SELECT * INTO s FROM public.instructor_test_submissions WHERE test_id=p_id AND account_number=p_account ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN
    UPDATE public.instructor_test_attempts SET result_failures=result_failures+1 WHERE test_id=p_id AND client_hash=client;
    RETURN jsonb_build_object('ok',false,'status','unavailable');
  END IF;
  UPDATE public.instructor_test_attempts SET result_failures=0 WHERE test_id=p_id AND client_hash=client;
  IF s.manual_count<>(SELECT count(*) FROM jsonb_object_keys(s.reviews)) THEN RETURN jsonb_build_object('ok',false,'status','pending'); END IF;
  correct:=s.auto_correct+public.atlas_instructor_review_points(s.snapshot,s.reviews);
  result:=jsonb_build_object('ok',true,'correct',round(correct,8),'total',s.total,'percentage',round(100*correct/s.total,2),'pending_review',0,'submission_id',s.id,
    'sections',public.atlas_instructor_section_results(s.snapshot,s.auto_results,s.reviews));
  RETURN jsonb_build_object('ok',true,'participant_name',s.participant_name,'account_number',s.account_number,'created_at',s.created_at,
    'snapshot',s.snapshot-'review_guides','answers',s.answers,'auto_results',s.auto_results,'reviews',s.reviews,'result',result);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_instructor_participant_result(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_instructor_participant_result(uuid,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.atlas_publish_instructor_test(p_id uuid, p_revision integer, p_publish boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE; v_actor integer; schedule_only boolean;
BEGIN
  v_actor := public.atlas_require_instructor_manager();
  SELECT * INTO STRICT v FROM public.instructor_tests WHERE id = p_id FOR UPDATE;
  IF p_revision IS DISTINCT FROM v.revision THEN
    RAISE EXCEPTION 'Otra persona modificó esta prueba. Vuelve a abrirla.' USING ERRCODE = '40001';
  END IF;
  IF p_publish IS NULL THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF p_publish THEN
    PERFORM public.atlas_validate_instructor_content(v.draft, true);
    IF v.code_hash IS NULL THEN RAISE EXCEPTION 'Configura el código antes de publicar'; END IF;
  END IF;
  schedule_only:=p_publish AND v.estado='publicada' AND (v.draft-'schedule')=(v.published-'schedule') AND (v.draft->'schedule') IS DISTINCT FROM (v.published->'schedule');
  UPDATE public.instructor_tests SET estado = CASE WHEN p_publish THEN 'publicada' ELSE 'borrador' END,
    published = CASE WHEN p_publish THEN draft ELSE NULL END,
    published_revision = CASE WHEN p_publish THEN revision + 1 ELSE NULL END,
    attempt_revision = CASE WHEN schedule_only THEN coalesce(v.attempt_revision,v.published_revision) WHEN p_publish THEN revision+1 ELSE attempt_revision END,
    revision = revision + 1, access_version = access_version + CASE WHEN schedule_only THEN 0 ELSE 1 END, updated_by = v_actor, updated_at = now()
    WHERE id = p_id;
  RETURN public.atlas_get_instructor_test(p_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.atlas_require_instructor_access(p_id uuid,p_token text)
RETURNS public.instructor_test_access LANGUAGE plpgsql SET search_path=public,extensions AS $$
DECLARE t public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id AND estado='publicada' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La prueba ya no esta publicada'; END IF;
  IF public.atlas_instructor_schedule_status(t.published)<>'open' THEN RAISE EXCEPTION 'El horario de la prueba finalizo. El progreso guardado se conserva'; END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE test_id=p_id AND token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND access_version=t.access_version AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tu acceso caduco. Introduce de nuevo el codigo'; END IF;
  RETURN a;
END;
$$;
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
  IF public.atlas_instructor_schedule_status(v.published)<>'open' THEN RAISE EXCEPTION 'El horario de la prueba finalizo. El progreso guardado se conserva'; END IF;
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
COMMIT;
