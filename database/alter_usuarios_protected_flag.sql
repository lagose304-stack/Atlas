-- ============================================================
-- Atlas de Histologia - Flag de usuario protegido
-- Este campo se administra solo en base de datos
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

-- Garantiza que registros existentes queden en estado apagado por defecto
UPDATE public.usuarios
SET is_protected = COALESCE(is_protected, false)
WHERE is_protected IS NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_is_protected
  ON public.usuarios (is_protected);
