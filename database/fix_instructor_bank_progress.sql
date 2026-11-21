-- Requiere setup_instructor_question_bank.sql.
-- Conserva la validación del progreso sobre el contenido asignado a cada intento.
-- Las pruebas tradicionales siguen usando el contenido publicado.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_save_instructor_progress(p_id uuid,p_token text,p_revision integer,p_answers jsonb,p_current_question_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; p public.instructor_test_progress%ROWTYPE; t public.instructor_tests%ROWTYPE;
  source_content jsonb; q jsonb; v jsonb; k text; item jsonb;
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
  source_content := coalesce(p.assigned_content, t.published);
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text)>500000 THEN RAISE EXCEPTION 'Progreso invalido'; END IF;
  IF p_current_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.atlas_instructor_public_questions(source_content)) x WHERE coalesce(x->'group'->>'id','legacy-'||(x->>'id'))=p_current_question_id) THEN RAISE EXCEPTION 'Pregunta de progreso invalida'; END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_answers) LOOP
    SELECT value INTO q FROM jsonb_array_elements(source_content->'questions') WHERE value->>'id'=k;
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

COMMIT;
