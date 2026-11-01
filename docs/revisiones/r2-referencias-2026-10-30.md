# Corrección preparada de referencias multimedia — 30 de octubre de 2026

**Estado: aplicada en producción con autorización explícita del usuario y verificada mediante lectura posterior.**

## Alcance

- 21 campos `prueba_preguntas.reference_photo_url`, en 10 evaluaciones publicadas del primer parcial.
- Una URL en el primer bloque de la publicación 52 (`subtemas_page`, tema 48).
- Son 22 referencias a 12 archivos distintos. Los 12 destinos R2 respondieron HTTP 200, con contenido de imagen no vacío.
- El tema 48 no existe actualmente en el catálogo. Se conserva su publicación y solo se prepara la sustitución de la URL cuyo archivo existe.
- No se modifican preguntas, opciones, calificación, señalados, relaciones, estados de publicación, imágenes faltantes del catálogo ni referencias sin archivo recuperable.
- No se borran, copian ni sobrescriben objetos R2.

## Preparación y comprobaciones

El [plan exacto](r2-referencias-2026-10-30.json) contiene IDs, valores anteriores y destinos comprobados. La consulta de precondiciones confirmó 21 preguntas y una publicación coincidentes, y que el cambio del JSON publicado afecta únicamente la URL prevista.

Se revisaron los triggers de ambas tablas: controles de permisos y actualización automática de `updated_at`. Las fechas de última modificación cambiarán al aplicar o revertir la corrección.

Respaldo local de los campos afectados y del snapshot publicado completo: `TEMP_r2_reference_backup_PRIVATE.txt`, en la raíz, excluido de Git y no destinado a publicación. SHA-256:

`4f7cc6432e9ce7cfbe3a1e2d3efb9c0857f91c6cd88cecea868648cec65b0081`

Este respaldo cubre los valores que cambia esta operación; no constituye un respaldo general de la base ni de R2. No incluye credenciales.

## Aplicación y recuperación

1. Obtener autorización explícita para actualizar estas 22 referencias en producción.
2. Revalidar disponibilidad de los 12 destinos y las precondiciones si hubo demora o nuevas ediciones.
3. Aplicar únicamente [la corrección preparada](r2-referencias-2026-10-30.sql). Es una transacción con límites de espera, bloqueo acotado, comparación de valores y fechas previos, recuentos y verificación final. Una discrepancia o error cancela todos los cambios.
4. Verificar con lectura las 22 URLs y la conservación de los demás datos; revisar la lectura pública sin enviar evaluaciones.
5. Si es necesario volver atrás, usar [la reversión](r2-referencias-2026-10-30.revert.sql) tras verificar estado y autorización. Restaura las URLs originales y conserva los demás campos; no restaura la antigua fecha `updated_at`. Si las URLs o la publicación cambiaron entretanto, se detiene para evitar sobreescribir ediciones posteriores.

Las referencias históricas no se limpian ni se eliminan. No ejecutar otros scripts de `database/` como parte de esta operación.

## Resultado de la operación autorizada

Se ejecutó la transacción preparada y se leyó después el estado confirmado: las 21 preguntas conservan sus IDs y relación con la evaluación, y sus URLs coinciden con el plan. La publicación 52 conserva tipo, tema, estado y todos sus bloques, salvo la URL prevista del primer bloque. La segunda imagen, sin archivo recuperable, quedó intacta. Los 12 archivos de destino se revalidaron con HEAD antes de aplicar el cambio. No se modificó ningún objeto R2 ni se ejecutó la reversión.

El [resultado verificable](r2-referencias-2026-10-30.resultado.json) registra los recuentos. La copia de recuperación permanece excluida de Git. Las comprobaciones verifican referencias y disponibilidad de archivos; no se enviaron evaluaciones ni se comprobó visualmente cada pregunta.
