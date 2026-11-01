# Mantenimiento de auditorías y lectura de imágenes — 30 de octubre de 2026

**Estado: correcciones locales verificadas; sin publicar. Las comprobaciones remotas fueron de solo lectura.**

## Auditorías

Los tres scripts comparten un lector y comparador en `scripts/lib/media-audit.mjs` y un ejecutor en `scripts/lib/run-media-audit.mjs`:

| Comando | Alcance |
| --- | --- |
| `node scripts/audit-images.mjs` | Cuenta y clasifica referencias; no demuestra que existan los archivos. |
| `node scripts/audit-integrity.mjs` | Compara originales y miniaturas con el inventario físico de R2; detecta faltantes y objetos referenciados vacíos. |
| `node scripts/audit-all-urls.mjs` | Comprueba originales por HTTP HEAD, con tiempo máximo y sin seguir redirecciones. No comprueba enlaces externos o páginas de navegación. |

Se consultan columnas explícitas de 13 fuentes: placas, lista de espera, temas, subtemas, evaluaciones, preguntas, perfiles y colaboradores de créditos, bloques, versiones nombradas, snapshots de publicación, historial de bloques y relación de mapas con sus placas. `content_blocks` usa `content`, no `body`; las versiones usan `blocks`, sin pedir una columna `version_number` inexistente. Los mapas no tienen `image_url` propio: se lee su `placa_id`. El inventario del centro de mantenimiento también resuelve la imagen desde la placa relacionada.

El lector pagina por identificador con conteo exacto, sigue aunque el servidor limite la cantidad de filas por respuesta y marca la cobertura como incompleta si falta una tabla o columna, falla un permiso o cambia el conteo. No interpreta esos errores como tablas vacías. La lectura administrativa usa únicamente la clave de servidor y no inicia sesiones de usuario ni invoca RPC.

Los informes quedan en `recovered_images/audits/`, excluido de Git, para evitar publicar contenido de la base. Las salidas de consola muestran conteos y códigos de error; no imprimen credenciales ni filas completas. Un error de consulta produce salida 2; hallazgos de disponibilidad o enlaces históricos producen salida 1; salida 0 significa comprobación completa sin hallazgos según el alcance del modo. No se deduce que un archivo sin referencias en estas fuentes pueda borrarse.

## Conversión y lectura

- La conversión del original y de la miniatura debe terminar correctamente antes de enviar la subida. Si falla la lectura, el canvas, las dimensiones o la codificación WebP, se informa un error y no se sube el archivo original como alternativa silenciosa.
- Se comprueba que el canvas devuelva un blob WebP no vacío; algunos navegadores pueden devolver otro formato aunque se solicite WebP.
- El frontend y los scripts comparten la resolución de almacenamiento de `src/services/r2ImageLocation.mjs`, con declaraciones TypeScript en `.d.mts`.
- Las referencias históricas se traducen a R2. Las alternativas de lectura y el componente de miniaturas no regresan al dominio del proveedor anterior.
- Las rutas R2 con extensiones reales JPG/PNG se conservan, con alternativa WebP para compatibilidad. Las miniaturas se derivan siempre con sufijo `_thumb.webp`.
- Se conservan parámetros y fragmentos de URL. La invalidación de caché actualiza `v` sin destruir otros parámetros ni duplicarlo. Las URLs externas existentes mantienen sus parámetros firmados.
- Se corrigió la lectura de URLs de otro dominio `r2.dev`, evitando generar una ruta que contenga un segundo protocolo.

El README multimedia y las variables públicas del workflow se actualizaron para R2. La clave de servidor permanece fuera del bundle y no usa prefijo `VITE_`. No se cambió ninguna variable remota ni se activó despliegue.

## Comprobaciones

- 384 pruebas automáticas aprobadas, incluidas regresiones de paginación, consultas incompletas, inventario truncado, objetos vacíos, alternativas R2, conversión fallida y relación de mapas.
- `npm run typecheck` y `npm run build` correctos; sintaxis Node comprobada en los módulos de auditoría y resolución.
- `audit-integrity.mjs`: lectura completa de las 13 fuentes, 1.744 referencias; 1.728 de almacenamiento y 16 enlaces de navegación del propio sitio. Sin referencias históricas en esas fuentes y sin miniaturas faltantes cuyo original exista.
- Los únicos 24 hallazgos de integridad son las placas del catálogo reservadas para recuperación: 314, 316–326, 328–333, 343, 370, 372–373, 431 y 761. La salida 1 es esperada por esos hallazgos; no se intentó repararlos ni eliminarlos.
- `audit-images.mjs`: lectura completa, mismo conteo de referencias y cero enlaces históricos.
- La consulta de la relación `interactive_maps → placas.photo_url` respondió HTTP 200 con lectura acotada. No se cambiaron mapas ni placas.

Informes de esta comprobación: `media-integrity-1793413235755.json` y `media-references-1793413413720.json`, dentro de la carpeta local de auditorías. El primer ensayo detectó y notificó expresamente la columna inexistente de mapas; tras corregirla, la auditoría quedó completa.

## Límites

Las lecturas paginadas no constituyen una instantánea transaccional de toda la base. No se probaron todos los archivos por HTTP durante esta revisión: la disponibilidad se contrastó con el inventario R2 y el comportamiento HTTP se probó con respuestas simuladas. No se auditan cuentas de usuarios, registros de visitas o auditoría histórica como si fueran referencias multimedia activas, ni se inspecciona cada imagen visualmente. Los cambios de código requieren publicación autorizada para afectar al sitio de producción.
