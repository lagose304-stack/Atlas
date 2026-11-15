-- Cambio local pendiente de revisión y autorización antes de producción.
-- Requiere security_hardening.sql y las funciones de sesión vigentes.
BEGIN;

-- Una sola fila: la jefatura es independiente de usuarios.rol.
CREATE TABLE public.atlas_microscopy_chief (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  user_id integer REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 0
);

-- Anclar la autoridad inicial a su ID impide apropiarse de ella cambiando un correo.
DO $$
DECLARE v_owner integer;
BEGIN
  IF (SELECT count(*) FROM public.usuarios
      WHERE lower(trim(username)) = 'elamlagos3@gmail.com' AND activo) <> 1 THEN
    RAISE EXCEPTION 'Se requiere una única cuenta inicial activa';
  END IF;
  SELECT id INTO v_owner FROM public.usuarios
  WHERE lower(trim(username)) = 'elamlagos3@gmail.com' AND activo;
  INSERT INTO public.atlas_microscopy_chief(owner_id) VALUES (v_owner);
END;
$$;

ALTER TABLE public.atlas_microscopy_chief ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atlas_microscopy_chief FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.atlas_get_microscopy_chief()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor integer := public.atlas_session_user_id(); v_state public.atlas_microscopy_chief%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_state FROM public.atlas_microscopy_chief;
  IF v_actor IS NULL OR (v_actor <> v_state.owner_id AND v_actor IS DISTINCT FROM v_state.user_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('user_id', v_state.user_id, 'revision', v_state.revision);
END;
$$;

-- Lectura limitada para la cuenta inicial; nunca expone contraseñas.
CREATE FUNCTION public.atlas_list_microscopy_candidates()
RETURNS TABLE(id integer, nombre text, username text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_get_microscopy_chief();
  RETURN QUERY SELECT u.id, u.nombre::text, u.username::text
    FROM public.usuarios u WHERE u.activo AND u.rol = 'Administrador' ORDER BY u.nombre, u.id;
END;
$$;

CREATE FUNCTION public.atlas_set_microscopy_chief(p_user_id integer, p_revision bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor integer; v_state public.atlas_microscopy_chief%ROWTYPE;
BEGIN
  -- Serializa transferencias; comprobar permisos DESPUÉS de obtener el bloqueo.
  SELECT * INTO STRICT v_state FROM public.atlas_microscopy_chief FOR UPDATE;
  v_actor := public.atlas_session_user_id();
  IF v_actor IS NULL OR (v_actor <> v_state.owner_id AND v_actor IS DISTINCT FROM v_state.user_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_revision IS DISTINCT FROM v_state.revision THEN
    RAISE EXCEPTION 'La jefatura cambió. Recarga e intenta de nuevo.' USING ERRCODE = '40001';
  END IF;
  IF p_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.usuarios WHERE id = p_user_id AND activo AND rol = 'Administrador' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El usuario debe ser un Administrador activo'; END IF;
  END IF;
  UPDATE public.atlas_microscopy_chief
    SET user_id = p_user_id, revision = revision + 1
    WHERE singleton = true;
END;
$$;

-- Evita que otro administrador tome la identidad del propietario o titular.
-- Los contadores de login y la renovación de sesiones mantienen su comportamiento.
CREATE FUNCTION public.atlas_guard_microscopy_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state public.atlas_microscopy_chief%ROWTYPE; v_actor integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.username IS NOT DISTINCT FROM OLD.username AND NEW.password IS NOT DISTINCT FROM OLD.password
       AND NEW.activo IS NOT DISTINCT FROM OLD.activo
       AND NEW.rol IS NOT DISTINCT FROM OLD.rol THEN RETURN NEW; END IF;
  END IF;
  -- Coordina las modificaciones de identidad con las transferencias.
  SELECT * INTO STRICT v_state FROM public.atlas_microscopy_chief FOR UPDATE;
  IF TG_OP = 'INSERT' THEN
    IF lower(trim(NEW.username)) = 'elamlagos3@gmail.com' OR EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = v_state.user_id
      AND lower(trim(u.username)) = lower(trim(NEW.username))) THEN
      RAISE EXCEPTION 'Correo reservado' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id = v_state.user_id AND NEW.rol IS DISTINCT FROM 'Administrador' THEN
      RAISE EXCEPTION 'Transfiere o retira la jefatura antes de cambiar el rol Administrador';
    END IF;
    IF NEW.username IS DISTINCT FROM OLD.username AND
      (OLD.id = v_state.owner_id OR lower(trim(NEW.username)) = 'elamlagos3@gmail.com' OR EXISTS (
        SELECT 1 FROM public.usuarios u WHERE u.id = v_state.user_id AND u.id <> OLD.id
        AND lower(trim(u.username)) = lower(trim(NEW.username)))) THEN
      RAISE EXCEPTION 'Correo reservado' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Bloquea desactivación/borrado del titular: transferir o retirar primero.
  IF OLD.id IN (v_state.owner_id, v_state.user_id) THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Retira primero la jefatura; la cuenta inicial se conserva'; END IF;
    IF NOT NEW.activo THEN RAISE EXCEPTION 'Retira primero la jefatura; la cuenta inicial se conserva'; END IF;
    v_actor := public.atlas_session_user_id();
    IF v_actor IS NULL OR (v_actor <> v_state.owner_id AND v_actor <> OLD.id) THEN
      RAISE EXCEPTION 'No puedes modificar la identidad de esta cuenta' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER atlas_guard_microscopy_identity
BEFORE INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.atlas_guard_microscopy_identity();

REVOKE ALL ON FUNCTION public.atlas_get_microscopy_chief() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_list_microscopy_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_set_microscopy_chief(integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_guard_microscopy_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_get_microscopy_chief(), public.atlas_list_microscopy_candidates(),
  public.atlas_set_microscopy_chief(integer, bigint) TO anon, authenticated;

-- Las funciones de login/validación se añaden debajo conservando su contrato.

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
      'is_protected', v_user.is_protected,
      'can_manage_microscopy', EXISTS (SELECT 1 FROM public.atlas_microscopy_chief c
        WHERE v_user.id = c.owner_id OR v_user.id = c.user_id)
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
    'is_protected', v_user.is_protected,
      'can_manage_microscopy', EXISTS (SELECT 1 FROM public.atlas_microscopy_chief c
        WHERE v_user.id = c.owner_id OR v_user.id = c.user_id)
  ));
END;
$$;

COMMIT;
