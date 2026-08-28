-- ============================================================================
-- Atlas - Script de Optimización de Rendimiento e Índices Compuestos
-- Ejecutar en Supabase SQL Editor para acelerar las consultas a < 1ms
-- ============================================================================

-- 1. Tabla TEMAS: Acelera ordenamiento por parcial y sort_order
CREATE INDEX IF NOT EXISTS idx_temas_parcial_sort 
  ON public.temas (parcial, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_temas_sort_order 
  ON public.temas (sort_order ASC, id ASC);

-- 2. Tabla SUBTEMAS: Acelera consultas por tema_id y ordenamiento por sort_order
CREATE INDEX IF NOT EXISTS idx_subtemas_tema_sort 
  ON public.subtemas (tema_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_subtemas_sort_order 
  ON public.subtemas (sort_order ASC, id ASC);

-- 3. Tabla PLACAS: Acelera carga de placas por subtema y tema
CREATE INDEX IF NOT EXISTS idx_placas_subtema_sort 
  ON public.placas (subtema_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_placas_tema_sort 
  ON public.placas (tema_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_placas_tema_subtema_sort 
  ON public.placas (tema_id, subtema_id, sort_order ASC);

-- 4. Tabla MAPAS INTERACTIVOS: Acelera verificación .in('placa_id', placaIds)
CREATE INDEX IF NOT EXISTS idx_interactive_maps_placa_id 
  ON public.interactive_maps (placa_id);

CREATE INDEX IF NOT EXISTS idx_interactive_maps_tema_subtema 
  ON public.interactive_maps (tema_id, subtema_id);

-- 5. Tabla SITE_RUNTIME_SETTINGS: Acelera consultas de mantenimiento en ID 1
CREATE INDEX IF NOT EXISTS idx_site_runtime_settings_id 
  ON public.site_runtime_settings (id);

-- 6. Tabla ATLAS_SESSIONS: Acelera validación de tokens de sesión
CREATE INDEX IF NOT EXISTS idx_atlas_sessions_token_active
  ON public.atlas_sessions (token_hash, expires_at) 
  WHERE revoked_at IS NULL;

-- 7. Actualizar estadísticas del optimizador de Postgres
ANALYZE public.temas;
ANALYZE public.subtemas;
ANALYZE public.placas;
ANALYZE public.interactive_maps;
ANALYZE public.site_runtime_settings;
ANALYZE public.atlas_sessions;
