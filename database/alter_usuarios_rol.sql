-- Agrega la columna rol a la tabla de usuarios
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

-- 1. Ampliar username para soportar emails
ALTER TABLE usuarios
  ALTER COLUMN username TYPE VARCHAR(255);

-- 2. Agregar columna rol con las tres opciones permitidas
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'Instructor'
  CHECK (rol IN ('Instructor', 'Microscopía', 'Administrador'));

-- 3. Habilitar RLS (por si no estaba activo)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Política de lectura (ya existente, la recreamos por si acaso)
DROP POLICY IF EXISTS "Permitir lectura de usuarios" ON usuarios;
CREATE POLICY "Permitir lectura de usuarios" ON usuarios
  FOR SELECT USING (true);

-- 5. Política de inserción (necesaria para crear usuarios)
DROP POLICY IF EXISTS "Permitir inserción de usuarios" ON usuarios;
CREATE POLICY "Permitir inserción de usuarios" ON usuarios
  FOR INSERT WITH CHECK (true);

-- 6. Política de actualización (necesaria para editar usuarios)
DROP POLICY IF EXISTS "Permitir actualización de usuarios" ON usuarios;
CREATE POLICY "Permitir actualización de usuarios" ON usuarios
  FOR UPDATE USING (true) WITH CHECK (true);

-- 7. Política de eliminación (necesaria para borrar usuarios)
DROP POLICY IF EXISTS "Permitir eliminación de usuarios" ON usuarios;
CREATE POLICY "Permitir eliminación de usuarios" ON usuarios
  FOR DELETE USING (true);
