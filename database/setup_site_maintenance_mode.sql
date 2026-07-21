-- ============================================================
-- Atlas - modo de mantenimiento para las vistas publicas
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_runtime_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'El sitio se encuentra temporalmente fuera de servicio por mantenimiento.',
  banner_enabled boolean NOT NULL DEFAULT false,
  banner_message text NOT NULL DEFAULT '',
  disabled_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL
);

INSERT INTO public.site_runtime_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_runtime_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_runtime_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_runtime_settings TO anon, authenticated;

DROP POLICY IF EXISTS atlas_runtime_settings_read ON public.site_runtime_settings;
CREATE POLICY atlas_runtime_settings_read
  ON public.site_runtime_settings
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.atlas_set_site_maintenance(
  p_enabled boolean,
  p_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id integer;
BEGIN
  SELECT u.id INTO v_user_id
  FROM public.usuarios u
  WHERE u.id = public.atlas_session_user_id()
    AND u.activo = true
    AND u.rol = 'Administrador'
    AND u.is_protected = true;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operacion reservada al administrador protegido'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.site_runtime_settings
  SET maintenance_enabled = COALESCE(p_enabled, false),
      maintenance_message = CASE
        WHEN NULLIF(trim(COALESCE(p_message, '')), '') IS NULL THEN maintenance_message
        ELSE left(trim(p_message), 500)
      END,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_set_site_maintenance(boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_set_site_maintenance(boolean, text) TO anon, authenticated;

ALTER TABLE public.site_runtime_settings ADD COLUMN IF NOT EXISTS banner_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.site_runtime_settings ADD COLUMN IF NOT EXISTS banner_message text NOT NULL DEFAULT '';
ALTER TABLE public.site_runtime_settings ADD COLUMN IF NOT EXISTS disabled_features jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.site_runtime_settings ADD COLUMN IF NOT EXISTS maintenance_starts_at timestamptz;
ALTER TABLE public.site_runtime_settings ADD COLUMN IF NOT EXISTS maintenance_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS public.site_control_audit_logs (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  user_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  username text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_client_errors (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  username text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_control_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_client_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_control_audit_logs, public.site_client_errors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_control_audit_logs, public.site_client_errors TO anon, authenticated;
GRANT INSERT ON public.site_client_errors TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.site_client_errors_id_seq TO anon, authenticated;
DROP POLICY IF EXISTS atlas_control_audit_admin_read ON public.site_control_audit_logs;
CREATE POLICY atlas_control_audit_admin_read ON public.site_control_audit_logs FOR SELECT USING (public.atlas_has_role(ARRAY['Administrador']));
DROP POLICY IF EXISTS atlas_client_errors_admin_read ON public.site_client_errors;
CREATE POLICY atlas_client_errors_admin_read ON public.site_client_errors FOR SELECT USING (public.atlas_has_role(ARRAY['Administrador']));
DROP POLICY IF EXISTS atlas_client_errors_insert ON public.site_client_errors;
CREATE POLICY atlas_client_errors_insert ON public.site_client_errors FOR INSERT WITH CHECK (length(event_type) BETWEEN 1 AND 80);

CREATE OR REPLACE FUNCTION public.atlas_protected_admin_id()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM public.usuarios u WHERE u.id = public.atlas_session_user_id()
    AND u.activo = true AND u.rol = 'Administrador' AND u.is_protected = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.atlas_update_site_controls(p_controls jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id integer; v_username text;
BEGIN
  v_user_id := public.atlas_protected_admin_id();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Operacion reservada al administrador protegido' USING ERRCODE = '42501'; END IF;
  SELECT username INTO v_username FROM public.usuarios WHERE id = v_user_id;
  UPDATE public.site_runtime_settings SET
    banner_enabled = COALESCE((p_controls->>'banner_enabled')::boolean, false),
    banner_message = left(COALESCE(p_controls->>'banner_message', ''), 500),
    disabled_features = COALESCE(p_controls->'disabled_features', '[]'::jsonb),
    maintenance_starts_at = NULLIF(p_controls->>'maintenance_starts_at', '')::timestamptz,
    maintenance_ends_at = NULLIF(p_controls->>'maintenance_ends_at', '')::timestamptz,
    updated_at = now(), updated_by = v_user_id WHERE id = 1;
  INSERT INTO public.site_control_audit_logs(event_type,user_id,username,details) VALUES ('site_controls_updated',v_user_id,v_username,p_controls);
END; $$;

CREATE OR REPLACE FUNCTION public.atlas_clean_stale_presence()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id integer; v_count integer;
BEGIN
  v_user_id := public.atlas_protected_admin_id();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Operacion no autorizada' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.site_online_presence WHERE last_seen < now() - interval '5 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.site_control_audit_logs(event_type,user_id,details) VALUES ('stale_presence_cleaned',v_user_id,jsonb_build_object('removed',v_count));
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.atlas_list_active_sessions()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'username',u.username,'created_at',s.created_at,'last_seen_at',s.last_seen_at,'expires_at',s.expires_at,'current',s.token_hash = encode(digest(COALESCE(public.atlas_request_token(),''),'sha256'),'hex')) ORDER BY s.last_seen_at DESC),'[]'::jsonb)
  FROM public.atlas_sessions s JOIN public.usuarios u ON u.id=s.user_id
  WHERE public.atlas_protected_admin_id() IS NOT NULL AND s.revoked_at IS NULL AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.atlas_revoke_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user_id integer; v_current_hash text;
BEGIN
  v_user_id := public.atlas_protected_admin_id();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Operacion no autorizada' USING ERRCODE='42501'; END IF;
  v_current_hash := encode(digest(COALESCE(public.atlas_request_token(),''),'sha256'),'hex');
  UPDATE public.atlas_sessions SET revoked_at=now() WHERE id=p_session_id AND token_hash <> v_current_hash;
  INSERT INTO public.site_control_audit_logs(event_type,user_id,details) VALUES ('session_revoked',v_user_id,jsonb_build_object('session_id',p_session_id));
END; $$;

REVOKE ALL ON FUNCTION public.atlas_protected_admin_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atlas_update_site_controls(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_clean_stale_presence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_list_active_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_revoke_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_update_site_controls(jsonb), public.atlas_clean_stale_presence(), public.atlas_list_active_sessions(), public.atlas_revoke_session(uuid) TO anon, authenticated;

COMMIT;
