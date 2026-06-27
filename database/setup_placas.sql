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
ALTER TABLE public.placas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.placas TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND policyname = 'Permitir lectura de placas'
  ) THEN
    CREATE POLICY "Permitir lectura de placas"
      ON public.placas
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND policyname = 'Permitir inserción de placas'
  ) THEN
    CREATE POLICY "Permitir inserción de placas"
      ON public.placas
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND policyname = 'Permitir actualización de placas'
  ) THEN
    CREATE POLICY "Permitir actualización de placas"
      ON public.placas
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND policyname = 'Permitir eliminación de placas'
  ) THEN
    CREATE POLICY "Permitir eliminación de placas"
      ON public.placas
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- Nota: La foto se guarda en Cloudinary en la carpeta:
--   placas/{nombre_del_tema}/{nombre_del_subtema}
-- Ejemplo: placas/Tejido_Epitelial/Epitelio_Simple
