-- ============================================================
-- Atlas - permite mantenimiento desde Supabase SQL Editor
-- Conserva la validacion de sesion para solicitudes web.
-- Ejecutar antes de otras migraciones administrativas.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_is_trusted_database_context()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.atlas_require_editor_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.atlas_is_trusted_database_context() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.atlas_has_role(ARRAY['Administrador', 'Microscopía']) THEN
    RAISE EXCEPTION 'Operacion administrativa no autorizada' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_require_admin_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.atlas_is_trusted_database_context() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.atlas_has_role(ARRAY['Administrador']) THEN
    RAISE EXCEPTION 'Operacion reservada al administrador' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_is_trusted_database_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_is_trusted_database_context() TO service_role;

COMMIT;
