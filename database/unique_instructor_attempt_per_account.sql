-- Aplicacion MANUAL despues de schedule_instructor_tests_and_results.sql.
-- Un intento por prueba/cuenta, independientemente de republicaciones.
-- Verifica respaldo antes de instalar. No elimina ni fusiona datos existentes.
-- Si existen duplicados, aborta toda la transaccion: revisarlos por separado.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.instructor_tests IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.instructor_test_progress, public.instructor_test_submissions IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.instructor_test_progress GROUP BY test_id,account_number HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM public.instructor_test_submissions WHERE account_number IS NOT NULL GROUP BY test_id,account_number HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Hay intentos o entregas duplicados por prueba/cuenta. Revisa y respalda esos registros antes de instalar; no se ha borrado ningun dato';
  END IF;
END;
$$;
CREATE UNIQUE INDEX IF NOT EXISTS instructor_progress_unique_account
  ON public.instructor_test_progress(test_id,account_number);
CREATE UNIQUE INDEX IF NOT EXISTS instructor_submission_unique_account
  ON public.instructor_test_submissions(test_id,account_number) WHERE account_number IS NOT NULL;

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
  IF EXISTS(SELECT 1 FROM public.instructor_test_submissions WHERE test_id=p_id AND account_number=p_account) THEN
    RAISE EXCEPTION 'Esta cuenta ya entrego esta prueba. Puedes consultar sus resultados cuando termine la revision';
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  INSERT INTO public.instructor_test_progress(test_id,test_revision,account_number,participant_name,active_token_hash)
    VALUES(p_id,coalesce(t.attempt_revision,t.published_revision),p_account,n,a.token_hash) ON CONFLICT(test_id,account_number) DO NOTHING;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND account_number=p_account FOR UPDATE;
  IF p.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta prueba'; END IF;
  IF p.test_revision<>coalesce(t.attempt_revision,t.published_revision) THEN
    RAISE EXCEPTION 'Esta cuenta tiene un intento de una version anterior. Contacta al responsable de la prueba';
  END IF;
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
  IF EXISTS(SELECT 1 FROM public.instructor_test_submissions WHERE test_id=p_id AND account_number=p_account) THEN
    RETURN jsonb_build_object('ok',false,'status','submitted');
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND account_number=p_account FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.instructor_test_attempts SET recovery_failures=recovery_failures+1 WHERE test_id=p_id AND client_hash=client;
    RETURN jsonb_build_object('ok',false,'status','not_found');
  END IF;
  IF p.submission_id IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'status','submitted'); END IF;
  IF p.test_revision<>coalesce(t.attempt_revision,t.published_revision) THEN
    RETURN jsonb_build_object('ok',false,'status','version_changed');
  END IF;
  IF a.result IS NOT NULL OR (a.progress_id IS NOT NULL AND a.progress_id<>p.id) THEN RAISE EXCEPTION 'Este acceso ya pertenece a otro intento'; END IF;
  IF p.active_token_hash<>a.token_hash THEN
    UPDATE public.instructor_test_progress SET active_token_hash=a.token_hash,revision=revision+1,updated_at=now() WHERE id=p.id RETURNING * INTO p;
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  UPDATE public.instructor_test_attempts SET recovery_failures=0 WHERE test_id=p_id AND client_hash=client;
  RETURN jsonb_build_object('ok',true,'participant_name',p.participant_name,'account_number',p.account_number,'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision);
END;
$$;
COMMIT;
