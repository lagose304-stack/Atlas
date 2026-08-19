-- ============================================================
-- Atlas de Histología — Seguimiento de creación y edición en pruebas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

-- 1. Agregar columnas para registrar quién creó y quién editó la prueba
ALTER TABLE public.pruebas
  ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_id INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Índices para acelerar consultas y ordenamientos por autor/editor/fecha de edición
CREATE INDEX IF NOT EXISTS idx_pruebas_created_by_id ON public.pruebas(created_by_id);
CREATE INDEX IF NOT EXISTS idx_pruebas_updated_by_id ON public.pruebas(updated_by_id);
CREATE INDEX IF NOT EXISTS idx_pruebas_updated_at ON public.pruebas(updated_at DESC);

-- 3. Asignar valores iniciales para pruebas existentes que no tenían registro previo
UPDATE public.pruebas
SET created_by_name = COALESCE(created_by_name, 'Administrador'),
    updated_by_name = COALESCE(updated_by_name, created_by_name, 'Administrador'),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE created_by_name IS NULL OR updated_by_name IS NULL;

-- 4. Actualizar la función RPC `guardar_prueba_completa` para registrar el usuario que editó
CREATE OR REPLACE FUNCTION public.guardar_prueba_completa(
  p_prueba_id UUID,
  p_nombre TEXT,
  p_instrucciones TEXT,
  p_preguntas JSONB,
  p_updated_by_id INTEGER DEFAULT NULL,
  p_updated_by_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pregunta JSONB;
  v_pregunta_id UUID;
  v_opcion JSONB;
BEGIN
  UPDATE public.pruebas
  SET nombre = p_nombre,
      instrucciones = p_instrucciones,
      updated_by_id = COALESCE(p_updated_by_id, updated_by_id),
      updated_by_name = COALESCE(NULLIF(p_updated_by_name, ''), updated_by_name),
      updated_at = NOW()
  WHERE id = p_prueba_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la prueba %', p_prueba_id;
  END IF;

  DELETE FROM public.prueba_preguntas
  WHERE prueba_id = p_prueba_id;

  FOR v_pregunta IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(p_preguntas, '[]'::jsonb))
  LOOP
    INSERT INTO public.prueba_preguntas (
      prueba_id,
      sort_order,
      tipo,
      titulo,
      retroalimentacion,
      required,
      reference_placa_id,
      reference_photo_url,
      reference_tema_name,
      reference_subtema_name,
      reference_senalado_x,
      reference_senalado_y,
      reference_senalado_start_x,
      reference_senalado_start_y
    )
    VALUES (
      p_prueba_id,
      COALESCE((v_pregunta->>'sortOrder')::integer, 0),
      'single_choice',
      COALESCE(v_pregunta->>'title', ''),
      COALESCE(v_pregunta->>'retroalimentacion', ''),
      COALESCE((v_pregunta->>'required')::boolean, TRUE),
      NULLIF(v_pregunta->>'referencePlacaId', '')::integer,
      NULLIF(v_pregunta->>'referencePhotoUrl', ''),
      NULLIF(v_pregunta->>'referenceTemaName', ''),
      NULLIF(v_pregunta->>'referenceSubtemaName', ''),
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'x', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'y', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startX', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startY', '')::numeric
    )
    RETURNING id INTO v_pregunta_id;

    FOR v_opcion IN
      SELECT *
      FROM jsonb_array_elements(COALESCE(v_pregunta->'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.prueba_pregunta_opciones (
        pregunta_id,
        sort_order,
        texto,
        is_correct
      )
      VALUES (
        v_pregunta_id,
        COALESCE((v_opcion->>'sortOrder')::integer, 0),
        COALESCE(v_opcion->>'text', ''),
        COALESCE((v_opcion->>'isCorrect')::boolean, FALSE)
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_prueba_completa(UUID, TEXT, TEXT, JSONB, INTEGER, TEXT) TO anon, authenticated;

-- 5. Asegurar que las funciones de autenticación retornen el nombre del usuario
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
      'id', v_user.id, 'username', v_user.username, 'nombre', v_user.nombre, 'rol', v_user.rol,
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
    'id', v_user.id, 'username', v_user.username, 'nombre', v_user.nombre, 'rol', v_user.rol,
    'activo', v_user.activo, 'session_version', v_user.session_version,
    'is_protected', v_user.is_protected
  ));
END;
$$;
