# Miniaturas y referencias irrecuperables — 30 de octubre de 2026

**Estado: aplicado en producción y verificado, por petición explícita del usuario.**

## Miniaturas

Se crearon las miniaturas de las placas 812, 813, 817, 819, 820, 898, 899 y 900, y de la portada de evaluación 56b9a583-0701-4b3d-ba83-435ad85def1a. Los nueve originales estaban disponibles y las nueve miniaturas ausentes en el almacenamiento. Se generaron archivos WebP de 480 píxeles de ancho con proporción conservada, calidad 78, sin ampliar el original.

Se guardaron copias locales de los originales, miniaturas y un manifiesto con ETags, dimensiones y SHA-256 en `recovered_images/r2-thumbnails-2026-10-30/`, excluido de Git. El [script acotado](../../scripts/repair-r2-thumbnails-2026-10-30.mjs) prepara sin escribir remotamente por defecto; la opción `--apply-thumbnails` comprueba el ETag del original, crea solo los destinos previstos y verifica su contenido almacenado. Utiliza escrituras condicionadas para evitar sobrescribir un objeto existente, conforme a la [compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/).

Se verificaron las nueve miniaturas por hash desde R2 y mediante HTTP 200 en sus URLs públicas. Los ETags de los originales no cambiaron. No se modificaron sus referencias en la base de datos.

## Referencias retiradas

- Siete campos `credit_contributors.photo_url` de los registros 4–10 quedaron en `NULL`.
- Tres campos `image_url` en borradores quedaron vacíos, conservando sus bloques.
- La URL de la segunda imagen de la publicación 52 quedó vacía. Se conservó la primera URL, corregida en la operación anterior.
- Dos campos de imagen dentro de la versión 229 quedaron vacíos, evitando que se recuperen esas referencias rotas al reutilizar la versión.

Son 13 referencias a 11 archivos irrecuperables, en 12 registros. Se comprobó mediante HEAD de R2 que los 11 destinos seguían ausentes. Se conservaron las personas, textos, estructuras, estados, IDs y relaciones. No se eliminaron filas ni objetos de almacenamiento. Las imágenes faltantes del catálogo no se incluyeron.

La [transacción aplicada](r2-referencias-irrecuperables-2026-10-30.sql) compara los valores, JSON completos y fechas previos; un cambio concurrente cancela toda la transacción. La lectura posterior confirmó los 13 campos vacíos, los 12 registros conservados y los demás contenidos JSON intactos. Los triggers existentes actualizan fechas de modificación en las tablas de contenido.

## Respaldo y recuperación

El respaldo específico `TEMP_r2_cleanup_backup_PRIVATE.txt` y el detalle `TEMP_r2_cleanup_patches_PRIVATE.txt` están en la raíz, ignorados y no rastreados por Git. SHA-256 del respaldo:

`0b853159b4e017920813cbe52982289fa8a41f0e67e43e0e7f3275eed7d210f3`

Se validó que el respaldo coincide con todos los valores previos y que la transformación inversa recupera íntegramente los JSON originales. El respaldo cubre los campos modificados y las estructuras de contenido afectadas; no constituye un respaldo general de la base de datos.

La [reversión preparada](r2-referencias-irrecuperables-2026-10-30.revert.sql) restaura las referencias originales únicamente si los valores actuales siguen coincidiendo con esta operación. Su ejecución necesita autorización concreta; no se ejecutó. Las fechas actualizadas por triggers no vuelven a su valor antiguo. Para retirar una miniatura creada, verificar primero su clave y hash contra el manifiesto y obtener autorización antes de borrarla; nunca tocar el original.

El [resultado](r2-miniaturas-y-referencias-2026-10-30.resultado.json) registra las comprobaciones. No se ejecutaron evaluaciones ni se publicaron cambios locales de código.
