# Plan de Implementación — Editor de Páginas 2.0 (Fase 3: Integración Pública Progresiva y Control de Transición)

> **Estado:** Implementada y verificada en local (Partes 1 a 5). Scripts SQL de `database/editor2/` pendientes de ejecución autorizada en Supabase.  
> **Prerrequisitos completados:** Fase 1 (motor de cuadrícula 24 columnas, borradores, versiones inmutables, publicación atómica) y Fase 2 (diseño libre, `Tarjeta / Caja`, temas globales, `RichTextV2`, insignias, iconos, lightbox, animaciones y 8 plantillas editables).  
> **Decisión de alcance:** No se construye migrador automático de contenido v1 → v2. El contenido de cada página se diseñará manualmente en Editor 2.0 y se activará página por página con respaldo automático en v1.

---

## 1. Principios de seguridad y cero riesgo

1. **Transición página por página con fallback automático a v1.** Cada página pública consulta si existe una versión publicada en `editor2` para su `pageKey`. Si existe, renderiza `Editor2Renderer`; si no existe (o si la consulta falla), sigue mostrando el contenido actual de v1 sin errores ni parpadeos.
2. **El borrador nunca se filtra al público.** `editor2_get_public_doc(pageKey)` solo devuelve documentos apuntados por `editor2.page_publications`.
3. **Cero peso extra en páginas que aún usan v1.** `Editor2Renderer` se carga de forma diferida (`React.lazy`) solo cuando la página tiene un documento v2 publicado, manteniendo liviano el bundle inicial de las páginas públicas.
4. **Reversión en 1 clic.** Si publicas una página en v2 y decides volver temporalmente al contenido anterior, el botón **«Volver a v1»** (`editor2_unpublish_page`) retira el puntero público sin borrar tu borrador ni tu historial de versiones.
5. **Protección de producción.** Ningún script de `database/editor2/` se ejecuta automáticamente en Supabase; su aplicación requiere verificación de respaldo y autorización explícita.

---

## 2. Desglose por partes

### Parte 1 — Puente público ligero (`Editor2PublicSlot` y caché)
- **Archivos nuevos en `src/editor2/public/`:**
  - `publicDocCache.ts`: cliente de lectura con caché breve en memoria (TTL corto + invalidación al publicar/despublicar desde la misma sesión) que llama a `editor2Api.getPublicDoc(pageKey)` y devuelve `null` ante cualquier error o ausencia de publicación.
  - `Editor2PublicSlot.tsx`: componente declarativo `<Editor2PublicSlot pageKey={...} fallback={...} />` que:
    - Carga el documento publicado de forma asíncrona.
    - Monta `Editor2Renderer` con `React.lazy` + `Suspense` solo cuando hay un documento v2 válido.
    - Usa un contenedor público limpio (`.e2-public-surface`, sin el marco ni sombra de `.e2-preview`) alineado al ancho y tipografía de Atlas.
    - Muestra `fallback` (el renderizado v1 actual) cuando no hay publicación v2 o si ocurre un error.
- **Pruebas:** `src/editor2/public/Editor2PublicSlot.test.tsx` (cubre v2 publicado, ausencia de publicación, error de red/RPC y caché).

### Parte 2 — Conexión progresiva en las 4 páginas públicas
Conectar `Editor2PublicSlot` de forma no invasiva en las cuatro páginas que hoy renderizan `ContentBlockRenderer`:

| Página pública | Archivo | `pageKey` | Comportamiento si hay v2 publicado | Fallback si no hay v2 |
| :--- | :--- | :--- | :--- | :--- |
| Inicio | `src/pages/Home.tsx` | `'home'` | Renderiza el documento v2 en la zona editorial principal (conservando header, ruta de aprendizaje, accesos y footer). | Renderiza `featuredPublication` y `weekly_histology_facts` actuales de v1. |
| Temario | `src/pages/TemarioPublico.tsx` | `'temario'` | Reemplaza el bloque `ContentBlockRenderer` superior por el documento v2. | Renderiza `contentBlocks` actuales de v1. |
| Tema / Subtemas | `src/pages/Subtemas.tsx` | `` `tema-${temaId}` `` | Reemplaza `ContentBlockRenderer` del tema por el documento v2. | Renderiza `contentBlocks` actuales de v1. |
| Placas del subtema | `src/pages/PlacasSubtema.tsx` | `` `subtema-${subtemaId}` `` | Reemplaza `ContentBlockRenderer` del subtema por el documento v2 (conservando la galería y visor de placas). | Renderiza `contentBlocks` actuales de v1. |

- **Pruebas:** pruebas de integración ligeras verificando que cada página mantiene el fallback v1 intacto cuando no hay publicación v2 y muestra `Editor2Renderer` cuando sí existe.

### Parte 3 — Widget dinámico en vivo: *Pruebas por parcial* (`examCarousel`)
- Nuevo bloque opcional del catálogo de Editor 2.0 (100 % aislado dentro de `src/editor2/`):
  - **Propiedades:** `parcial` (`'all' | '1' | '2' | '3'`), `title` (título opcional), `accentColor`, `maxItems`, `style?: BlockStyle`.
  - **Consulta de solo lectura:** reutiliza la consulta de evaluaciones publicadas (`tests` activos en Supabase) en modo solo lectura, filtrando por parcial.
  - **Renderizado:** carrusel/rejilla responsive con tarjetas limpias y botón directo a `/evaluaciones/ejecutar/:id`. En el editor muestra vista previa en vivo o estado informativo si el parcial no tiene pruebas activas.
  - **Plantilla actualizada:** *Semana de exámenes* puede incorporar o combinarse en 1 clic con este widget en vivo.
- **Pruebas:** esquema Zod, ida y vuelta con Puck, renderizado con pruebas simuladas y estado vacío.

### Parte 4 — Control de transición y reversión instantánea (`Volver a v1`)
- **SQL local (sin ejecución remota automática):**
  - `database/editor2/003_unpublish.sql`: crea la RPC `public.editor2_unpublish_page(p_page_key text)` protegida por `editor2.assert_session()` que elimina únicamente la fila correspondiente en `editor2.page_publications` (conservando `page_drafts` y `page_versions` intactos).
  - Actualizar `database/editor2/999_drop.sql` para incluir el `DROP FUNCTION IF EXISTS public.editor2_unpublish_page(text)`.
- **Interfaz en Editor 2.0:**
  - En `SaveBar.tsx`:
    - Indicador claro del estado real en el sitio: **«Publicada en v2»** vs **«Mostrando v1 en público»**.
    - Botón secundario **«Volver a v1»** (solo visible cuando la página está publicada en v2, con diálogo de confirmación) para despublicar en 1 clic.
    - Enlace directo **«Abrir en sitio público»** hacia la ruta pública real (`/`, `/temario`, `/subtemas/:id`, `/ver-placas/:id`) junto a la vista previa `/vista-v2/:pageKey`.
  - En la lista/buscador de páginas (`Editor2HomePage.tsx`): distintivo visual rápido para identificar qué páginas ya están en vivo con v2 y cuáles siguen en v1.
- **Pruebas:** `SaveBar.test.tsx` y `editor2Api.test.ts` cubriendo `unpublishPage` y actualización de estado.

### Parte 5 — Verificación integral y checklist de puesta en producción
- **Verificación local obligatoria antes de cerrar:**
  - `npm test` (suite completa).
  - `npm run typecheck` y `npm run build` (confirmar code-splitting de `Editor2Renderer`).
  - `npm run design:check`.
- **Checklist manual para activar en Supabase (solo cuando el usuario autorice expresamente):**
  1. Confirmar respaldo vigente de la base de datos en Supabase.
  2. Ejecutar en orden:
     - `database/editor2/001_setup.sql`
     - `database/editor2/002_presets_templates.sql`
     - `database/editor2/003_unpublish.sql`
  3. Validar en local contra una página piloto: guardar borrador → publicar → comprobar ruta pública real → probar «Volver a v1» → volver a publicar.
  4. Solo tras aprobación expresa del usuario, subir a GitHub (`git push`).

---

## 3. Fuera de alcance en Fase 3
- Conversor o migrador automático de bloques `content_blocks` (v1) a `CanvasDoc` (v2).
- Eliminación o modificación del editor v1 (`/editor-paginas`) ni de sus tablas `content_*` (se conservan intactos como respaldo).
- Ejecución automática de migraciones SQL en Supabase o `git push` sin orden escrita.
