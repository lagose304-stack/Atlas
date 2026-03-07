-- Agregar columna sort_order a la tabla subtemas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

ALTER TABLE subtemas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Inicializar sort_order con el orden actual (por nombre, dentro de cada tema)
WITH ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY tema_id ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM subtemas
)
UPDATE subtemas
SET sort_order = ordenados.nuevo_orden
FROM ordenados
WHERE subtemas.id = ordenados.id;
