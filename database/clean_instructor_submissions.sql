-- PLANTILLA DE LIMPIEZA MANUAL. No ejecutar automaticamente.
-- Antes: exportar las entregas y revisiones que se quieran conservar.
-- Borra respuestas de TODAS las pruebas de instructores, NO las preguntas ni archivos R2.
-- Tambien elimina accesos temporales: todos deberan volver a introducir el codigo y nombre.
-- Bloquea durante la limpieza; si hay otra operacion en curso, aborta tras 5 segundos.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.instructor_tests IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.instructor_test_access, public.instructor_test_submissions IN ACCESS EXCLUSIVE MODE;
TRUNCATE TABLE public.instructor_test_submissions, public.instructor_test_access;
-- Revisar alcance y sustituir ROLLBACK por COMMIT solamente con autorizacion expresa.
ROLLBACK;
