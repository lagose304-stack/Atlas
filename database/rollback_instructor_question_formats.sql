-- Respaldo de las tres definiciones remotas del 14 de noviembre de 2026.
-- Solo para recuperación autorizada antes de usar los formatos nuevos.
-- Si ya se guardaron preguntas nuevas, deshabilitar las RPC y conservar los datos.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.instructor_tests t,
    LATERAL jsonb_array_elements((t.draft->'questions') || coalesce(t.published->'questions','[]'::jsonb)) q
    WHERE coalesce(q->>'type','single_choice') <> 'single_choice') THEN
    RAISE EXCEPTION 'Ya hay preguntas de formatos nuevos; deshabilita el sistema antes de planificar la recuperación';
  END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  q jsonb; v_total integer; v_correct integer := 0; v_result jsonb;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  SELECT * INTO a FROM public.instructor_test_access
    WHERE token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex') AND test_id = p_id
      AND access_version = v.access_version AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','expired'); END IF;
  -- Una única entrega por acceso; reintentos de red devuelven el mismo resultado.
  IF a.result IS NOT NULL THEN RETURN a.result; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Respuestas inválidas'; END IF;
  v_total := jsonb_array_length(v.published->'questions');
  FOR q IN SELECT value FROM jsonb_array_elements(v.published->'questions') LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id' = p_answers->>(q->>'id')) THEN
      RAISE EXCEPTION 'Responde todas las preguntas';
    END IF;
    IF p_answers->>(q->>'id') = q->>'correct_option_id' THEN v_correct := v_correct + 1; END IF;
  END LOOP;
  v_result := jsonb_build_object('ok',true,'correct',v_correct,'total',v_total,'percentage',round(100.0*v_correct/v_total,2));
  UPDATE public.instructor_test_access SET result = v_result WHERE token_hash = a.token_hash;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atlas_unlock_instructor_test(p_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_attempts%ROWTYPE;
  v_client text; v_token text; v_questions jsonb;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  -- La cabecera debe proceder del proxy de confianza. Sin IP se comparte un límite conservador.
  v_client := encode(digest(coalesce(nullif(trim(split_part(
    coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''), ',', 1)),''),
    'unknown'), 'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES (p_id,v_client) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT a FROM public.instructor_test_attempts
    WHERE test_id = p_id AND client_hash = v_client FOR UPDATE;
  IF a.window_start <= now() - interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET failures = 0, window_start = now()
      WHERE test_id = p_id AND client_hash = v_client;
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
  SELECT jsonb_agg(jsonb_build_object('id',q->>'id','titulo',q->>'titulo','options',
      (SELECT jsonb_agg(jsonb_build_object('id',o->>'id','texto',o->>'texto') ORDER BY n)
       FROM jsonb_array_elements(q->'options') WITH ORDINALITY AS y(o,n))) ORDER BY ord)
    INTO v_questions FROM jsonb_array_elements(v.published->'questions') WITH ORDINALITY AS x(q,ord);
  RETURN jsonb_build_object('ok',true,'token',v_token,'test',jsonb_build_object(
    'nombre',v.published->>'nombre','instrucciones',v.published->>'instrucciones','questions',v_questions));
END;
$function$;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_content(p_content jsonb, p_publish boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE q jsonb; o jsonb;
BEGIN
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR jsonb_typeof(p_content->'nombre') IS DISTINCT FROM 'string'
     OR length(trim(p_content->>'nombre')) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_content->'instrucciones') IS DISTINCT FROM 'string'
     OR length(p_content->>'instrucciones') > 10000
     OR jsonb_typeof(p_content->'questions') IS DISTINCT FROM 'array'
     OR octet_length(p_content::text) > 500000 THEN
    RAISE EXCEPTION 'Contenido inválido';
  END IF;
  IF jsonb_array_length(p_content->'questions') > 100
     OR (p_publish AND jsonb_array_length(p_content->'questions') = 0) THEN
    RAISE EXCEPTION 'La prueba admite entre 1 y 100 preguntas al publicarse';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'questions') x
             GROUP BY x->>'id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Preguntas repetidas';
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(p_content->'questions') LOOP
    IF jsonb_typeof(q) <> 'object' OR coalesce(length(q->>'id'),0) NOT BETWEEN 1 AND 80
       OR jsonb_typeof(q->'titulo') IS DISTINCT FROM 'string' OR length(q->>'titulo') > 5000
       OR jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Pregunta inválida';
    END IF;
    IF jsonb_array_length(q->'options') NOT BETWEEN 2 AND 8
       OR (p_publish AND trim(q->>'titulo') = '') THEN RAISE EXCEPTION 'Completa el enunciado y las opciones'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x GROUP BY x->>'id' HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'Opciones repetidas';
    END IF;
    FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
      IF jsonb_typeof(o) <> 'object' OR coalesce(length(o->>'id'),0) NOT BETWEEN 1 AND 80
         OR jsonb_typeof(o->'texto') IS DISTINCT FROM 'string' OR length(o->>'texto') > 3000
         OR (p_publish AND trim(o->>'texto') = '') THEN RAISE EXCEPTION 'Opción inválida'; END IF;
    END LOOP;
    IF p_publish AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x
                                 WHERE x->>'id' = q->>'correct_option_id') THEN
      RAISE EXCEPTION 'Selecciona una respuesta correcta en cada pregunta';
    END IF;
  END LOOP;
END;
$function$;

-- Se conservan los auxiliares nuevos, privados y sin acceso directo.
COMMIT;
