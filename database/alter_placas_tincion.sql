-- Añadir columna tincion a la tabla placas
ALTER TABLE placas ADD COLUMN IF NOT EXISTS tincion TEXT;
