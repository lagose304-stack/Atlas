-- ==================================================================================
-- Atlas de Histología — Lista de Espera Depurada (Sin Duplicados)
-- Se eliminaron 502 placas que ya están clasificadas en el temario.
-- Total de placas pendientes reales: 0
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Limpiar lista de espera
TRUNCATE TABLE public.placas_sin_clasificar RESTART IDENTITY;

-- No hay placas pendientes (todas las 502 ya fueron clasificadas previamente en el temario).
