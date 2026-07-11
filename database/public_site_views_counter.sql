-- ============================================================
-- Atlas - contador publico seguro de visualizaciones
-- Expone solamente el total; los registros individuales siguen
-- protegidos por RLS y visibles unicamente para Administradores.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_get_total_site_views()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.site_analytics_events
  WHERE event_type = 'site_visit';
$$;

REVOKE ALL ON FUNCTION public.atlas_get_total_site_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_get_total_site_views() TO anon, authenticated;

COMMIT;
