-- ============================================================
-- Atlas de Histologia - Seguridad de sesion para usuarios
-- Agrega columnas para desactivacion y revocacion de sesiones
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- Asegura datos consistentes para filas existentes
UPDATE public.usuarios
SET
  activo = COALESCE(activo, true),
  session_version = COALESCE(session_version, 1)
WHERE activo IS NULL OR session_version IS NULL;

-- Indice util para autenticacion y revalidacion rapida
CREATE INDEX IF NOT EXISTS idx_usuarios_username_activo
  ON public.usuarios (username, activo);
