---
name: atlas-desarrollo
description: Investigar, corregir y modificar el proyecto Atlas de histología siguiendo sus conexiones entre React, sesiones propias, contenido publicado, Supabase y R2. Usar en tareas sobre este repositorio, incluidos fallos, mejoras y cambios de interfaz o persistencia; no para proyectos ajenos.
---

# Desarrollo de Atlas

## Orientación

Trabaja desde la raíz del repositorio que contiene esta habilidad; no dependas de una ruta absoluta de la computadora actual. Lee [AGENTS.md](../../../AGENTS.md) y consulta el mapa del área afectada en [la guía de Atlas](../../../docs/guia-atlas.md). Sigue las instrucciones vigentes del usuario y el alcance de su tarea.

Usa la guía para localizar fuentes, no como sustituto de leer la implementación. Para investigar datos remotos, consulta [el inventario verificado de Supabase](../../../docs/supabase-inventario.md), incluyendo su fecha y límites. No necesitas acceder a servicios externos para una tarea que pueda resolverse y comprobarse en local.

## Investigar con un alcance concreto

- Identifica el comportamiento esperado y el recorrido que falla o cambiará. Busca con `rg` rutas, componentes, imports, llamadas y pruebas relacionados; amplía la exploración cuando aparezca una dependencia relevante.
- Sigue el recorrido del área: página y estado → componentes → servicios o consultas directas → API/RPC → persistencia. No toda consulta está centralizada en servicios.
- En archivos grandes, localiza primero funciones y consumidores; lee los fragmentos que expliquen el estado y los efectos implicados. No hagas una refactorización general para resolver un cambio puntual.
- Distingue lo que demuestra el código, lo que confirma una prueba y lo verificado en remoto. Un SQL local no demuestra el esquema desplegado.

## Elegir las conexiones que revisar

| Si cambia… | Revisa conjuntamente… |
| --- | --- |
| Sesión o acceso | `AuthContext`, `PrivateRoute`, permisos, rutas especiales de `App.tsx`, `X-Atlas-Session` y RPC/políticas implicadas. Conserva la distinción entre fallo de red y sesión invalidada. |
| Imágenes o placas | Servicios con nombres históricos, API del entorno objetivo, original, miniatura, referencias y cachés. Vite, Express y Worker no son implementaciones intercambiables. |
| Bloques o páginas | Tipos, registro, normalización, editores, renderer, borrador, versiones y snapshot público. Comprueba JSON guardado y el recorrido de lectura alternativo. |
| Evaluaciones | Editor, guardado completo, preguntas/opciones, lectura pública, calificación e imágenes compartidas o propias. |
| Mapas o anotaciones | Formato persistido, coordenadas, zoom, visor y referencias a la placa. |
| Navegación o estilos | Filtros, parámetros, scroll, componentes compartidos, escritorio y pantallas pequeñas según el cambio. |

## Preparar y comprobar el cambio

Implementa el cambio local mínimo que satisfaga la tarea. Conserva compatibilidad de IDs, URLs, campos guardados y llamadas existentes salvo que cambiarlos sea parte del encargo. Antes de borrar código aparentemente antiguo, verifica consumidores: hay componentes de `archived/` que siguen importándose.

Selecciona las comprobaciones de la sección 6 de la guía. Aprovecha pruebas existentes; añade pruebas para comportamientos relevantes, sin duplicar mecánicamente la implementación. Para frontend, usa pruebas relacionadas, tipos y compilación según el alcance. Para cambios visuales, revisa el recorrido con contenido representativo. TypeScript no valida SQL ni las distintas APIs de servidor.

No uses el sitio real para crear, editar, publicar, mover o eliminar datos como prueba sin autorización específica. Localhost y las vistas previas pueden apuntar a Supabase y R2 reales. Con datos aislados, confirma también el destino de persistencia.

## Cuando intervenga Supabase o R2

Aplica las reglas de producción de `AGENTS.md`. Para investigar, utiliza metadatos o lecturas acotadas; no invoques RPC hasta entender sus efectos. Si hay varias firmas, comprueba tipos y resolución de la llamada. No confundas RLS activado o la existencia de políticas con autorización correcta.

Si la solución exige escribir en producción, termina primero la preparación revisable: cambio local, alcance, dependencias, comprobaciones y recuperación. Verifica un respaldo adecuado y solicita autorización explícita para la operación concreta. No ejecutes scripts históricos o migraciones como exploración. Continúa el trabajo local independiente mientras una operación remota siga sin autorización.

No publiques ni hagas push sin petición expresa. La habilidad no concede permisos externos ni exige conectar servicios para todas las tareas.

## Cerrar el trabajo

Explica en español qué cambió, qué comprobaste y las limitaciones relevantes. Informa si queda una operación remota pendiente; no declares corregido un comportamiento que no pudiste verificar. Actualiza la guía si cambia arquitectura o funcionamiento, y el inventario solo con nuevas observaciones remotas fechadas. No guardes secretos ni registros personales en documentación.
