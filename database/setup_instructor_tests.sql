-- Sistema independiente. NO ejecutar sin revisar, respaldar y autorizar producción.
-- Instalado con autorización el 14 de noviembre de 2026:
-- migración add_instructor_tests_system. No repetir sobre los objetos existentes.
-- Requiere sesiones Atlas, atlas_microscopy_chief y pgcrypto en extensions.
BEGIN;

CREATE TABLE public.instructor_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft jsonb NOT NULL,
  published jsonb,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  code_hash text,
  revision integer NOT NULL DEFAULT 1,
  published_revision integer,
  access_version integer NOT NULL DEFAULT 1,
  updated_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (estado <> 'publicada' OR (published IS NOT NULL AND code_hash IS NOT NULL))
);
CREATE INDEX instructor_tests_published ON public.instructor_tests(created_at, id) WHERE estado = 'publicada';

CREATE TABLE public.instructor_test_access (
  token_hash text PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.instructor_tests(id) ON DELETE CASCADE,
  access_version integer NOT NULL,
  expires_at timestamptz NOT NULL,
  result jsonb
);
CREATE INDEX instructor_test_access_test_id ON public.instructor_test_access(test_id);
CREATE TABLE public.instructor_test_attempts (
  test_id uuid NOT NULL REFERENCES public.instructor_tests(id) ON DELETE CASCADE,
  client_hash text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, client_hash)
);
ALTER TABLE public.instructor_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_test_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_test_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_tests, public.instructor_test_access, public.instructor_test_attempts
  FROM PUBLIC, anon, authenticated;

-- Valida autoridad actual y bloquea transferencias durante la escritura.
CREATE FUNCTION public.atlas_require_instructor_manager()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor integer; v_chief public.atlas_microscopy_chief%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_chief FROM public.atlas_microscopy_chief WHERE singleton = true FOR SHARE;
  v_actor := public.atlas_session_user_id();
  IF v_actor IS NULL OR (v_actor <> v_chief.owner_id AND v_actor IS DISTINCT FROM v_chief.user_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END;
$$;

-- Los borradores pueden estar incompletos; la publicación exige preguntas válidas.
CREATE FUNCTION public.atlas_validate_instructor_content(p_content jsonb, p_publish boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
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
$$;

CREATE FUNCTION public.atlas_list_instructor_tests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  RETURN coalesce((SELECT jsonb_agg(x) FROM (
    SELECT id, draft->>'nombre' AS nombre, estado, revision, published_revision, updated_at
    FROM public.instructor_tests ORDER BY updated_at DESC, id LIMIT 100
  ) x), '[]'::jsonb);
END;
$$;
CREATE FUNCTION public.atlas_get_instructor_test(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO STRICT v FROM public.instructor_tests WHERE id = p_id;
  RETURN jsonb_build_object('id',v.id,'content',v.draft,'estado',v.estado,'revision',v.revision,
    'published_revision',v.published_revision,'has_code',v.code_hash IS NOT NULL);
END;
$$;

CREATE FUNCTION public.atlas_save_instructor_test(p_id uuid, p_revision integer, p_content jsonb, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; v_actor integer; v_hash text;
BEGIN
  v_actor := public.atlas_require_instructor_manager();
  PERFORM public.atlas_validate_instructor_content(p_content, false);
  IF p_code IS NOT NULL AND p_code !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El código debe tener exactamente 6 dígitos';
  END IF;
  IF p_code IS NOT NULL THEN v_hash := crypt(p_code, gen_salt('bf', 10)); END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.instructor_tests(draft,code_hash,updated_by)
      VALUES (p_content,v_hash,v_actor) RETURNING * INTO v;
  ELSE
    SELECT * INTO STRICT v FROM public.instructor_tests WHERE id = p_id FOR UPDATE;
    IF p_revision IS DISTINCT FROM v.revision THEN
      RAISE EXCEPTION 'Otra persona modificó esta prueba. Vuelve a abrirla.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.instructor_tests SET draft = p_content, revision = revision + 1,
      code_hash = coalesce(v_hash,code_hash), access_version = access_version + CASE WHEN v_hash IS NULL THEN 0 ELSE 1 END,
      updated_by = v_actor, updated_at = now() WHERE id = p_id RETURNING * INTO v;
  END IF;
  RETURN jsonb_build_object('id',v.id,'content',v.draft,'estado',v.estado,'revision',v.revision,
    'published_revision',v.published_revision,'has_code',v.code_hash IS NOT NULL);
END;
$$;

CREATE FUNCTION public.atlas_publish_instructor_test(p_id uuid, p_revision integer, p_publish boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE; v_actor integer;
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
  UPDATE public.instructor_tests SET estado = CASE WHEN p_publish THEN 'publicada' ELSE 'borrador' END,
    published = CASE WHEN p_publish THEN draft ELSE NULL END,
    published_revision = CASE WHEN p_publish THEN revision + 1 ELSE NULL END,
    revision = revision + 1, access_version = access_version + 1, updated_by = v_actor, updated_at = now()
    WHERE id = p_id;
  RETURN public.atlas_get_instructor_test(p_id);
END;
$$;

-- El catálogo nunca devuelve códigos, preguntas ni respuestas correctas.
CREATE FUNCTION public.atlas_public_instructor_tests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT id, published->>'nombre' AS nombre, published->>'instrucciones' AS instrucciones,
      jsonb_array_length(published->'questions') AS question_count
    FROM public.instructor_tests WHERE estado = 'publicada' ORDER BY created_at, id LIMIT 100
  ) x;
$$;

CREATE FUNCTION public.atlas_unlock_instructor_test(p_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
$$;

CREATE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
$$;

REVOKE ALL ON FUNCTION public.atlas_require_instructor_manager(), public.atlas_validate_instructor_content(jsonb,boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atlas_list_instructor_tests(), public.atlas_get_instructor_test(uuid),
  public.atlas_save_instructor_test(uuid,integer,jsonb,text), public.atlas_publish_instructor_test(uuid,integer,boolean),
  public.atlas_public_instructor_tests(), public.atlas_unlock_instructor_test(uuid,text),
  public.atlas_grade_instructor_test(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_list_instructor_tests(), public.atlas_get_instructor_test(uuid),
  public.atlas_save_instructor_test(uuid,integer,jsonb,text), public.atlas_publish_instructor_test(uuid,integer,boolean),
  public.atlas_public_instructor_tests(), public.atlas_unlock_instructor_test(uuid,text),
  public.atlas_grade_instructor_test(uuid,text,jsonb) TO anon, authenticated;
COMMIT;
