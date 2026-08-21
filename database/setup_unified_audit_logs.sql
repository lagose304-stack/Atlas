-- ====================================================================
-- Atlas de Histología - Sistema Unificado de Auditoría y Monitoreo
-- Crea la tabla unified_audit_logs con soporte para placas, pruebas,
-- editor de páginas, temas/subtemas, usuarios y sesiones.
-- Incluye soporte para purga y limpieza por rangos de fechas.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.unified_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  entity_type VARCHAR(50) NOT NULL,    -- 'placa', 'prueba', 'pagina', 'tema', 'subtema', 'mapa', 'usuario', 'sesion', 'sistema'
  action_type VARCHAR(60) NOT NULL,    -- 'create', 'update', 'delete', 'classify', 'publish', 'restore', 'reorder', 'login', 'logout', 'role_change', 'maintenance_toggle'
  entity_id VARCHAR(100) NULL,         -- ID numérico o slug del recurso (ej: "45", "creditos", "evaluacion-1")
  entity_name VARCHAR(255) NOT NULL,   -- Nombre legible (ej: "Placa #45 - Hígado", "Prueba: Tejido Epitelial")
  actor_user_id INTEGER NULL,          -- ID del usuario en tabla usuarios
  actor_username VARCHAR(120) NULL,    -- Username de acceso
  actor_name VARCHAR(150) NOT NULL,    -- Nombre real completo (ej: "Dr. Lagos", "Administrador")
  actor_role VARCHAR(50) NULL,         -- Rol al momento de la acción ('Administrador', 'Microscopía', etc.)
  details JSONB NOT NULL DEFAULT '{}'::jsonb, -- Metadatos enriquecidos: imagen, subtema, tema, aumento, tinción, cambios
  ip_address VARCHAR(45) NULL
);

-- Índices para consultas y filtros instantáneos
CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_created_at 
  ON public.unified_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_entity_type 
  ON public.unified_audit_logs (entity_type);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_action_type 
  ON public.unified_audit_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_actor_user_id 
  ON public.unified_audit_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_actor_name 
  ON public.unified_audit_logs (actor_name);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_details_gin
  ON public.unified_audit_logs USING gin (details);

-- Migración segura de registros históricos previos de placas_activity_logs (si existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'placas_activity_logs') THEN
    INSERT INTO public.unified_audit_logs (
      created_at, entity_type, action_type, entity_id, entity_name, actor_user_id, actor_username, actor_name, actor_role, details
    )
    SELECT 
      pal.created_at,
      'placa' AS entity_type,
      CASE 
        WHEN pal.action_type IN ('upload_classified', 'upload_unclassified') THEN 'create'
        WHEN pal.action_type = 'classify_waiting_plate' THEN 'classify'
        WHEN pal.action_type = 'edit_plate' THEN 'update'
        WHEN pal.action_type IN ('delete_classified', 'delete_unclassified') THEN 'delete'
        ELSE pal.action_type
      END AS action_type,
      COALESCE(pal.placa_id::text, pal.waiting_plate_id::text) AS entity_id,
      COALESCE(
        CASE
          WHEN s.nombre IS NOT NULL THEN 'Placa #' || COALESCE(pal.placa_id::text, pal.waiting_plate_id::text) || ' - ' || s.nombre
          WHEN (pal.details->>'nombre_placa') IS NOT NULL THEN (pal.details->>'nombre_placa')
          ELSE 'Placa #' || COALESCE(pal.placa_id::text, pal.waiting_plate_id::text, 'sin ID')
        END,
        'Placa'
      ) AS entity_name,
      pal.actor_user_id,
      pal.actor_username,
      COALESCE(u.nombre, pal.actor_username, 'Usuario del sistema') AS actor_name,
      u.rol AS actor_role,
      jsonb_build_object(
        'photo_url', COALESCE(p.photo_url, (pal.details->>'photo_url')),
        'aumento', COALESCE(p.aumento, (pal.details->>'aumento')),
        'tincion', COALESCE(p.tincion, (pal.details->>'tincion')),
        'comentario', COALESCE(p.comentario, (pal.details->>'comentario')),
        'tema_id', COALESCE(p.tema_id, (pal.details->>'tema_id')::int),
        'tema_nombre', COALESCE(t.nombre, (pal.details->>'tema_nombre')),
        'subtema_id', COALESCE(p.subtema_id, (pal.details->>'subtema_id')::int),
        'subtema_nombre', COALESCE(s.nombre, (pal.details->>'subtema_nombre')),
        'nombre_placa', COALESCE(
          CASE WHEN s.nombre IS NOT NULL THEN 'Placa #' || COALESCE(pal.placa_id::text, pal.waiting_plate_id::text) || ' - ' || s.nombre END,
          (pal.details->>'nombre_placa')
        ),
        'original_details', pal.details
      ) AS details
    FROM public.placas_activity_logs pal
    LEFT JOIN public.usuarios u ON u.id = pal.actor_user_id
    LEFT JOIN public.placas p ON p.id = pal.placa_id
    LEFT JOIN public.subtemas s ON s.id = COALESCE(p.subtema_id, (pal.details->>'subtema_id')::int)
    LEFT JOIN public.temas t ON t.id = COALESCE(p.tema_id, (pal.details->>'tema_id')::int, s.tema_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.unified_audit_logs ual 
      WHERE ual.created_at = pal.created_at 
        AND ual.entity_id = COALESCE(pal.placa_id::text, pal.waiting_plate_id::text)
    );
  END IF;
END $$;

-- Seguridad RLS (Row Level Security)
ALTER TABLE public.unified_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.unified_audit_logs TO anon;
GRANT SELECT, INSERT, DELETE ON public.unified_audit_logs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'unified_audit_logs' 
      AND policyname = 'Permitir insercion de auditoria unificada'
  ) THEN
    CREATE POLICY "Permitir insercion de auditoria unificada"
      ON public.unified_audit_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'unified_audit_logs' 
      AND policyname = 'Permitir lectura de auditoria unificada'
  ) THEN
    CREATE POLICY "Permitir lectura de auditoria unificada"
      ON public.unified_audit_logs
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'unified_audit_logs' 
      AND policyname = 'Permitir eliminacion de auditoria unificada'
  ) THEN
    CREATE POLICY "Permitir eliminacion de auditoria unificada"
      ON public.unified_audit_logs
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- Procedimiento almacenado para purga segura por fechas
CREATE OR REPLACE FUNCTION public.purge_unified_audit_logs(
  p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_entity_type VARCHAR DEFAULT NULL,
  p_action_type VARCHAR DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM public.unified_audit_logs
  WHERE (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to)
    AND (p_entity_type IS NULL OR p_entity_type = 'all' OR entity_type = p_entity_type)
    AND (p_action_type IS NULL OR p_action_type = 'all' OR action_type = p_action_type);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_unified_audit_logs TO anon, authenticated;
