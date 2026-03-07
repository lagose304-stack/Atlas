-- Agregar columna sort_order a la tabla placas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

ALTER TABLE placas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Inicializar sort_order con el orden actual (por created_at, dentro de cada subtema)
WITH ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY subtema_id ORDER BY created_at ASC) - 1 AS nuevo_orden
  FROM placas
)
UPDATE placas
SET sort_order = ordenados.nuevo_orden
FROM ordenados
WHERE placas.id = ordenados.id;
