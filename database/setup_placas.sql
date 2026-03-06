-- Script SQL para crear la tabla de placas en Supabase
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

-- Crear la tabla de placas
CREATE TABLE IF NOT EXISTS placas (
  id SERIAL PRIMARY KEY,
  photo_url TEXT NOT NULL,
  tema_id INTEGER NOT NULL REFERENCES temas(id) ON DELETE CASCADE,
  subtema_id INTEGER NOT NULL REFERENCES subtemas(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_placas_tema_id ON placas(tema_id);
CREATE INDEX IF NOT EXISTS idx_placas_subtema_id ON placas(subtema_id);

-- Habilitar Row Level Security
ALTER TABLE placas ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública
CREATE POLICY "Permitir lectura de placas" ON placas
  FOR SELECT
  USING (true);

-- Permitir inserción (para usuarios autenticados o anónimos según tu config)
CREATE POLICY "Permitir inserción de placas" ON placas
  FOR INSERT
  WITH CHECK (true);

-- Permitir eliminación
CREATE POLICY "Permitir eliminación de placas" ON placas
  FOR DELETE
  USING (true);

-- Nota: La foto se guarda en Cloudinary en la carpeta:
--   placas/{nombre_del_tema}/{nombre_del_subtema}
-- Ejemplo: placas/Tejido_Epitelial/Epitelio_Simple
