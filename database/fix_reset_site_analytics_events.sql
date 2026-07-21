-- ============================================================
-- Atlas - repara el reinicio de estadisticas tras security_hardening.sql
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_site_analytics_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = public.atlas_session_user_id()
      AND u.activo = true
      AND u.rol = 'Administrador'
      AND u.is_protected = true
  ) THEN
    RAISE EXCEPTION 'Operacion reservada al administrador protegido'
      USING ERRCODE = '42501';
  END IF;

  -- Compatible con la proteccion de Supabase que exige WHERE en DELETE.
  DELETE FROM public.site_analytics_events
  WHERE id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_site_analytics_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_site_analytics_events() TO anon, authenticated;

COMMIT;
