# Activación de movimiento de placas — 2 de noviembre de 2026

Autorización explícita en el chat: «si autorizo», referida a instalar la función nueva, sin mover placas.

## Estado previo y recuperación

Antes de instalar se confirmó por catálogo que `public.atlas_move_plate(integer,integer,integer,integer,integer)` no existe (`to_regprocedure` devuelve NULL). No hay definición anterior ni permisos que sobrescribir. Se conserva el SQL revisado en `database/setup_move_plate.sql`; el cambio solo agrega esa función y sus permisos. No modifica filas ni tablas existentes. Para esta instalación aditiva, el estado anterior respaldado es la ausencia del objeto, recuperable retirando exclusivamente la función nueva tras autorización. Esto no es un respaldo de las placas ni autoriza movimientos de prueba en producción.

Se verificaron privilegios SELECT/UPDATE del rol anon en placas e interactive_maps. Se conserva SECURITY INVOKER y la comprobación de rol mediante la sesión propia de Atlas; no se incorporan credenciales ni se cambia RLS.

## Resultado

Instalada mediante `add_atlas_move_plate`. Catálogo remoto confirma SECURITY INVOKER, `search_path=public`, EXECUTE para anon/authenticated y sin EXECUTE para PUBLIC. Se revisó la definición instalada. Una prueba como rol anon sin sesión Atlas, con IDs inexistentes dentro de una transacción revertida, confirmó rechazo 42501 antes de adquirir bloqueos o leer placas. No se movieron filas reales.

Los asesores de seguridad no identificaron esta función en sus hallazgos; los avisos devueltos corresponden a otros objetos, fuera de este cambio. La interfaz continúa local, sin push.
