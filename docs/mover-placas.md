# Mover placas conservando asociaciones

## Implementación local

Gestión de placas → Reasignación → **Mover placa** abre `/trasladar-placa`, protegida para Administrador y Microscopía. El editor anterior continúa disponible por separado. Se elige tema/subtema de origen, una miniatura (48 por página), tema/subtema de destino y confirmación con ID y destino visibles. Cambiar el origen descarta la selección; las respuestas atrasadas de consultas no reemplazan el listado actual.

`src/services/movePlate.ts` invoca `atlas_move_plate` usando el cliente existente y `X-Atlas-Session`. Envía ID, ubicación esperada y destino. No envía copias de señalados, imágenes ni mapas. Un resultado vacío no se interpreta como éxito. Invalida la caché de origen y destino después de confirmar. El registro de auditoría usa el servicio existente; es posterior al movimiento y no forma parte de la transacción.

## Dependencias verificadas

La creación en `Placas.tsx` guarda ID, `photo_url`, tema/subtema, orden, aumento, tinción, comentario, señalados y sus coordenadas. La URL de R2 contiene históricamente nombres de tema/subtema, pero es una clave de almacenamiento: no es necesario cambiarla para reclasificar. Conservarla evita romper usos por URL en contenido publicado o evaluaciones.

Lectura de metadatos remotos del 2 de noviembre de 2026: `interactive_maps.placa_id` y `prueba_preguntas.reference_placa_id` referencian `placas.id`. Los mapas contienen además tema/subtema y una restricción única `(tema_id, map_number)`. Placas y mapas tienen el trigger de autorización de editor; mapas también actualiza su fecha de modificación. No hay un trigger que sincronice automáticamente la ubicación del mapa.

El movimiento conserva ID de placa, URL, señalados y coordenadas, aumento, tinción, comentario y fecha de creación. Conserva ID del mapa, `placa_id` y `sections`; cambia sus tema/subtema y, solo si hay colisión, el número de presentación dentro del tema. Las preguntas y los bloques que referencian el ID o URL siguen apuntando a la misma placa. No se cambian las categorías de las evaluaciones ni se reescriben snapshots publicados.

## Transacción y pruebas

`database/setup_move_plate.sql` prepara una función **SECURITY INVOKER** que comprueba el rol de la sesión propia, bloquea brevemente escrituras concurrentes en placas/mapas, valida existencia y pertenencia del destino, verifica la ubicación esperada y actualiza placa/mapa en una sola transacción. Se añade al final del subtema destino; no renumera otras placas. Si cualquier actualización falla, todo retrocede. Los bloqueos afectan temporalmente a otras escrituras de estas dos tablas, no a las lecturas normales.

Pruebas locales:

- `npm test -- src/services/movePlate.test.ts src/pages/TrasladarPlaca.test.tsx`: siete casos de selección, confirmación, errores, contrato de la llamada e invalidación de caché.
- `database/tests/verify_move_plate.mjs`: PostgreSQL aislado con PGlite, datos ficticios y rol `anon`; comprueba rechazo sin permiso, destino incompatible, origen cambiado, destino idéntico, conservación de datos, colisión de mapas, cambio dentro del tema, placa sin mapa y rollback ante fallo después de actualizar el mapa. Recibe como argumento la ruta local a `@electric-sql/pglite/dist/index.js`; no utiliza Supabase ni carga `.env`.
- Navegador local a 1440 y 390 px con datos/servicios simulados y red externa bloqueada: selección, confirmación, éxito y ausencia de desbordamiento. No valida permisos ni persistencia reales.
- Tipos y compilación del frontend.

## Activación y recuperación

La función se instaló con autorización el **2 de noviembre de 2026**, mediante `add_atlas_move_plate`. Se verificaron definición, permisos y rechazo sin sesión propia de Atlas. No se movieron placas reales. La interfaz continúa local, sin publicar. Ver [registro de activación](revisiones/mover-placa-activacion-2026-11-02.md).

Antes del primer movimiento real, disponer de respaldo adecuado de la placa y sus mapas (incluidos ubicación, orden y número), identificar usos publicados que puedan tener nombres de categorías escritos manualmente y confirmar el origen/destino. No se ha verificado un respaldo de datos de producción en esta tarea.

Si se necesita retirar una instalación nueva sin usos posteriores, puede retirarse la función `public.atlas_move_plate(integer,integer,integer,integer,integer)` tras autorización y volver al frontend anterior. Eso no revierte movimientos ya realizados. Un movimiento confirmado se recupera con una transacción revisada que restaure ubicación, orden y número del mapa desde el respaldo, verificando antes conflictos con cambios posteriores. Nunca borrar/recrear la placa ni mover/eliminar el archivo R2 para deshacerlo.
