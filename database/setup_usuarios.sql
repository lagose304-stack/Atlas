-- Script SQL para crear la tabla de usuarios en Supabase
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

-- Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar usuarios de ejemplo (cambia estos datos según tus necesidades)
INSERT INTO usuarios (username, password, nombre) VALUES
  ('admin', 'admin123', 'Administrador'),
  ('editor', 'editor123', 'Editor Principal');

-- Configurar políticas de seguridad (Row Level Security)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Permitir que cualquiera pueda leer la tabla (necesario para el login)
CREATE POLICY "Permitir lectura de usuarios" ON usuarios
  FOR SELECT
  USING (true);

-- Nota: En producción, deberías usar un hash de contraseña (bcrypt, argon2, etc.)
-- en lugar de almacenar contraseñas en texto plano.
