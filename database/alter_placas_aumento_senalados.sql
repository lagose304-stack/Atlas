-- ============================================================
-- Añadir columnas: aumento, senalados y comentario a placas
-- ============================================================

-- 1. Aumento: valor de magnificación del microscopio (x4, x10, x40, x50, x100)
ALTER TABLE placas
  ADD COLUMN IF NOT EXISTS aumento VARCHAR(5)
    CHECK (aumento IN ('x4', 'x10', 'x40', 'x50', 'x100'));

-- 2. Señalados: lista de estructuras o elementos señalados en la placa
--    Se almacena como arreglo de texto de PostgreSQL
ALTER TABLE placas
  ADD COLUMN IF NOT EXISTS senalados TEXT[];

-- 3. Comentario: observación libre sobre la placa
ALTER TABLE placas
  ADD COLUMN IF NOT EXISTS comentario TEXT;

-- ============================================================
-- Verificar que las columnas se crearon correctamente
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'placas'
--   AND column_name IN ('aumento', 'senalados', 'comentario');
