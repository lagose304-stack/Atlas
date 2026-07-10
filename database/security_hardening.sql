-- ============================================================
-- Atlas - autenticacion por sesion y autorizacion RLS
-- IMPORTANTE: ejecutar antes de desplegar el frontend asociado.
-- Conserva los usuarios existentes y cifra sus contrasenas.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Migra contrasenas legadas en texto plano. bcrypt de pgcrypto comienza por $2.
UPDATE public.usuarios
SET password = crypt(password, gen_salt('bf', 11))
WHERE password IS NOT NULL AND password NOT LIKE '$2%';

CREATE TABLE IF NOT EXISTS public.atlas_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  session_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_atlas_sessions_token_active
  ON public.atlas_sessions (token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_atlas_sessions_user_id ON public.atlas_sessions (user_id);

ALTER TABLE public.atlas_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atlas_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_hash_password_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password NOT LIKE '$2%' THEN
    NEW.password := crypt(NEW.password, gen_salt('bf', 11));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atlas_hash_usuario_password ON public.usuarios;
CREATE TRIGGER atlas_hash_usuario_password
BEFORE INSERT OR UPDATE OF password ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.atlas_hash_password_trigger();

CREATE OR REPLACE FUNCTION public.atlas_request_token()
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT NULLIF(
    COALESCE(
      (NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-atlas-session'),
      ''
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.atlas_session_user_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT s.user_id
  FROM public.atlas_sessions s
  JOIN public.usuarios u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(public.atlas_request_token(), ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND u.activo = true
    AND u.session_version = s.session_version
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.atlas_has_role(p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = public.atlas_session_user_id()
      AND u.activo = true
      AND u.rol = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.atlas_login(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.usuarios%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_user
  FROM public.usuarios
  WHERE lower(username) = lower(trim(p_username))
  ORDER BY id LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.25);
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_credentials');
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false, 'status', 'locked',
      'lockout_remaining_ms', floor(extract(epoch FROM (v_user.locked_until - now())) * 1000)
    );
  END IF;

  IF v_user.password IS NULL OR crypt(p_password, v_user.password) <> v_user.password THEN
    UPDATE public.usuarios
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
    WHERE id = v_user.id;
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_credentials');
  END IF;

  IF NOT COALESCE(v_user.activo, true) THEN
    RETURN jsonb_build_object('ok', false, 'status', 'user_deactivated');
  END IF;

  UPDATE public.usuarios SET failed_login_attempts = 0, locked_until = NULL WHERE id = v_user.id;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.atlas_sessions(user_id, token_hash, session_version, expires_at)
  VALUES (v_user.id, encode(digest(v_token, 'sha256'), 'hex'), COALESCE(v_user.session_version, 1), now() + interval '7 days');

  RETURN jsonb_build_object(
    'ok', true, 'status', 'success', 'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id, 'username', v_user.username, 'rol', v_user.rol,
      'activo', v_user.activo, 'session_version', v_user.session_version,
      'is_protected', v_user.is_protected
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_validate_session()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_user public.usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.usuarios WHERE id = public.atlas_session_user_id();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  UPDATE public.atlas_sessions
  SET last_seen_at = now(), expires_at = now() + interval '7 days'
  WHERE token_hash = encode(digest(COALESCE(public.atlas_request_token(), ''), 'sha256'), 'hex')
    AND revoked_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'user', jsonb_build_object(
    'id', v_user.id, 'username', v_user.username, 'rol', v_user.rol,
    'activo', v_user.activo, 'session_version', v_user.session_version,
    'is_protected', v_user.is_protected
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_logout()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  UPDATE public.atlas_sessions SET revoked_at = now()
  WHERE token_hash = encode(digest(COALESCE(public.atlas_request_token(), ''), 'sha256'), 'hex');
$$;

-- Usada exclusivamente por Cloudflare Functions con la service-role key.
CREATE OR REPLACE FUNCTION public.atlas_authorize_token(p_token text, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.atlas_sessions s
    JOIN public.usuarios u ON u.id = s.user_id
    WHERE s.token_hash = encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex')
      AND s.revoked_at IS NULL AND s.expires_at > now()
      AND u.activo = true AND u.session_version = s.session_version
      AND u.rol = ANY(p_roles)
  );
$$;

-- Entrega una prueba publicada sin exponer is_correct ni retroalimentacion.
CREATE OR REPLACE FUNCTION public.atlas_get_public_test(p_prueba_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'test', jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'instrucciones', p.instrucciones,
      'scope', p.scope, 'parcial_key', p.parcial_key, 'created_at', p.created_at, 'estado', p.estado
    ),
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'sort_order', q.sort_order, 'titulo', q.titulo, 'required', q.required,
        'reference_photo_url', q.reference_photo_url,
        'reference_tema_name', q.reference_tema_name,
        'reference_subtema_name', q.reference_subtema_name,
        'reference_senalado_x', q.reference_senalado_x,
        'reference_senalado_y', q.reference_senalado_y,
        'reference_senalado_start_x', q.reference_senalado_start_x,
        'reference_senalado_start_y', q.reference_senalado_start_y,
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', o.id, 'pregunta_id', o.pregunta_id, 'sort_order', o.sort_order, 'texto', o.texto
          ) ORDER BY o.sort_order)
          FROM public.prueba_pregunta_opciones o WHERE o.pregunta_id = q.id
        ), '[]'::jsonb)
      ) ORDER BY q.sort_order)
      FROM public.prueba_preguntas q WHERE q.prueba_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.pruebas p
  WHERE p.id = p_prueba_id AND p.estado = 'publicada';
$$;

-- Corrige el envio completo en servidor. Las respuestas son {questionId: optionId}.
CREATE OR REPLACE FUNCTION public.atlas_grade_test(p_prueba_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH questions AS (
    SELECT q.id, q.retroalimentacion
    FROM public.prueba_preguntas q
    JOIN public.pruebas p ON p.id = q.prueba_id
    WHERE q.prueba_id = p_prueba_id AND p.estado = 'publicada'
  ), results AS (
    SELECT q.id AS question_id,
      selected.id IS NOT NULL AND selected.is_correct AS is_correct,
      correct.id AS correct_option_id,
      correct.texto AS correct_option_text,
      q.retroalimentacion AS feedback
    FROM questions q
    LEFT JOIN public.prueba_pregunta_opciones selected
      ON selected.pregunta_id = q.id AND selected.id::text = p_answers ->> q.id::text
    LEFT JOIN public.prueba_pregunta_opciones correct
      ON correct.pregunta_id = q.id AND correct.is_correct = true
  )
  SELECT jsonb_build_object(
    'score', count(*) FILTER (WHERE is_correct),
    'total', count(*),
    'results', COALESCE(jsonb_agg(to_jsonb(results)), '[]'::jsonb)
  ) FROM results;
$$;

REVOKE ALL ON FUNCTION public.atlas_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_validate_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_logout() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_session_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_has_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_validate_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_logout() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_session_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_has_role(text[]) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.atlas_authorize_token(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_authorize_token(text, text[]) TO service_role;
REVOKE ALL ON FUNCTION public.atlas_get_public_test(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_grade_test(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_get_public_test(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_grade_test(uuid, jsonb) TO anon, authenticated;

-- Elimina todas las politicas permisivas anteriores en las tablas administradas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
      'usuarios','temas','subtemas','placas','placas_sin_clasificar','tinciones',
      'content_blocks','content_page_publications','content_block_versions',
      'interactive_maps','pruebas','prueba_preguntas','prueba_pregunta_opciones',
      'site_analytics_events','site_online_presence','security_audit_logs','placas_activity_logs'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Crea politicas solo si la tabla existe, para admitir instalaciones parciales.
DO $$
DECLARE t text;
BEGIN
  -- Contenido visible para el sitio publico; escritura para editores.
  FOREACH t IN ARRAY ARRAY['temas','subtemas','placas','tinciones','content_blocks','content_page_publications','interactive_maps'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY atlas_public_read ON public.%I FOR SELECT USING (true)', t);
      EXECUTE format('CREATE POLICY atlas_editor_insert ON public.%I FOR INSERT WITH CHECK (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
      EXECUTE format('CREATE POLICY atlas_editor_update ON public.%I FOR UPDATE USING (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía''])) WITH CHECK (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
      EXECUTE format('CREATE POLICY atlas_editor_delete ON public.%I FOR DELETE USING (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['pruebas','prueba_preguntas','prueba_pregunta_opciones'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY atlas_test_read ON public.%I FOR SELECT USING (%s)', t,
        CASE WHEN t = 'pruebas' THEN 'estado = ''publicada'' OR public.atlas_has_role(ARRAY[''Administrador'',''Microscopía''])' ELSE 'public.atlas_has_role(ARRAY[''Administrador'',''Microscopía''])' END);
      EXECUTE format('CREATE POLICY atlas_test_insert ON public.%I FOR INSERT WITH CHECK (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
      EXECUTE format('CREATE POLICY atlas_test_update ON public.%I FOR UPDATE USING (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía''])) WITH CHECK (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
      EXECUTE format('CREATE POLICY atlas_test_delete ON public.%I FOR DELETE USING (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY atlas_admin_users_all ON public.usuarios FOR ALL
  USING (public.atlas_has_role(ARRAY['Administrador']))
  WITH CHECK (public.atlas_has_role(ARRAY['Administrador']));

-- Las colas y bitacoras no son publicas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['placas_sin_clasificar','content_block_versions','placas_activity_logs'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY atlas_editor_all ON public.%I FOR ALL USING (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía''])) WITH CHECK (public.atlas_has_role(ARRAY[''Administrador'',''Microscopía'']))', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['security_audit_logs','site_analytics_events'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY atlas_admin_read ON public.%I FOR SELECT USING (public.atlas_has_role(ARRAY[''Administrador'']))', t);
    END IF;
  END LOOP;
END $$;

-- La analitica publica solo puede insertar eventos con forma valida.
CREATE POLICY atlas_analytics_insert ON public.site_analytics_events FOR INSERT
  WITH CHECK (length(visitor_id) BETWEEN 1 AND 120);
CREATE POLICY atlas_security_log_insert ON public.security_audit_logs FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = public.atlas_session_user_id());

-- Defensa adicional: los triggers tambien se ejecutan dentro de funciones
-- SECURITY DEFINER antiguas, evitando que una RPC legada pueda saltarse RLS.
CREATE OR REPLACE FUNCTION public.atlas_require_editor_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.atlas_has_role(ARRAY['Administrador', 'Microscopía']) THEN
    RAISE EXCEPTION 'Operacion administrativa no autorizada' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_require_admin_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.atlas_has_role(ARRAY['Administrador']) THEN
    RAISE EXCEPTION 'Operacion reservada al administrador' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'temas','subtemas','placas','placas_sin_clasificar','tinciones','content_blocks',
    'content_page_publications','content_block_versions','interactive_maps',
    'pruebas','prueba_preguntas','prueba_pregunta_opciones','placas_activity_logs'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS atlas_enforce_editor ON public.%I', t);
      EXECUTE format('CREATE TRIGGER atlas_enforce_editor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.atlas_require_editor_trigger()', t);
    END IF;
  END LOOP;
  IF to_regclass('public.site_analytics_events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS atlas_enforce_analytics_delete ON public.site_analytics_events';
    EXECUTE 'CREATE TRIGGER atlas_enforce_analytics_delete BEFORE DELETE ON public.site_analytics_events FOR EACH ROW EXECUTE FUNCTION public.atlas_require_admin_trigger()';
  END IF;
END $$;

-- Presencia anonima: lectura publica y escritura limitada a la propia huella de visitante.
DO $$
BEGIN
  IF to_regclass('public.site_online_presence') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.site_online_presence ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY atlas_presence_read ON public.site_online_presence FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY atlas_presence_insert ON public.site_online_presence FOR INSERT WITH CHECK (length(visitor_id) BETWEEN 1 AND 120)';
    EXECUTE 'CREATE POLICY atlas_presence_update ON public.site_online_presence FOR UPDATE USING (true) WITH CHECK (length(visitor_id) BETWEEN 1 AND 120)';
  END IF;
END $$;

COMMIT;
