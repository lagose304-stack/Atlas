-- ============================================================
-- Añadir columna para metadata de señalados con ubicación
-- ============================================================

ALTER TABLE placas
  ADD COLUMN IF NOT EXISTS senalados_meta JSONB;

-- Estructura esperada por elemento:
-- {
--   "label": "Texto del señalado",
--   "x": 0.45,
--   "y": 0.31
-- }
-- x/y normalizados entre 0 y 1; cuando no exista ubicación se permiten null.
