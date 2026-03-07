-- Agregar columna sort_order a la tabla temas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

ALTER TABLE temas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Inicializar sort_order con el orden actual (por nombre, dentro de cada parcial)
-- Esto asigna valores 0, 1, 2... a cada tema según su nombre, por parcial
WITH ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY parcial ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM temas
)
UPDATE temas
SET sort_order = ordenados.nuevo_orden
FROM ordenados
WHERE temas.id = ordenados.id;
