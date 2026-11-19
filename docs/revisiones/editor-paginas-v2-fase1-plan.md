# Editor de páginas 2.0 — Plan de Fase 1

**Fecha del plan:** 17 de noviembre de 2026.
**Estado:** Fase 1 completada (Partes 0 a 7 cerradas y verificadas: 110 archivos / 859 pruebas globales en verde, aislamiento comprobado, tipado, build y `design:check` en PASS). Sin push ni publicación de frontend.
**Referencia previa:** [inventario del editor actual](editor-paginas-inventario-2026-11-17.md).

**Objetivo:** dejar funcionando, de forma aislada y removible, un editor nuevo con lienzo, primitivos, texto bruto, imágenes, distribución, navegación rediseñada, persistencia propia y versiones con borrador y publicación separados. La Fase 2 queda reservada para diseño, decoración, tokens, temas y edición enriquecida.

---

## 0. Principios rectores

1. **Paralelo, nunca conjunto.** El 2.0 convive con `/editor-paginas` sin importar sus componentes, tipos, renderer, servicios ni tablas.
2. **Removible en una pasada.** Todo vive en `src/editor2/`, un predicado en `src/security/`, unas pocas líneas en `App.tsx` y una tarjeta en `Edicion.tsx`. La base de datos nueva tiene esquema propio y script de borrado.
3. **Sin migración de contenido en Fase 1.** No se leen ni se escriben `content_blocks`, `content_page_versions`, `content_page_publications` ni `content_block_versions`.
4. **Persistencia propia.** Se crea un esquema lógico nuevo en el mismo proyecto de Supabase, con tablas y RPC propias. No se reutiliza ninguna tabla del editor actual.
5. **El borrador nunca es público.** La lectura pública solo devuelve el documento de una versión publicada. Si no hay publicación, no hay fallback al borrador.
6. **La versión pública es inmutable.** Guardar el borrador jamás cambia lo que ve el visitante. Publicar crea una versión nueva y mueve el puntero de publicación de forma atómica.
7. **La tarjeta oculta no es la seguridad.** La interfaz oculta la entrada para quien no corresponda; las RPC siguen exigiendo sesión de Atlas y roles válidos.
8. **Diseño diferido.** La Fase 1 resuelve función y estructura. Tokens, temas, decoración, Tiptap, Biome y React Compiler quedan fuera.

---

## 1. Decisiones ya aceptadas

| Tema | Decisión |
| --- | --- |
| Motor de composición | Puck, mediante el paquete oficial mantenido `@puckeditor/core`, para slots, arrastre y edición en lienzo. No se persiste su forma interna. |
| Contrato de datos | Zod en todas las fronteras: RPC, URL, almacenamiento local y conversión desde Puck. |
| Estado del editor | Zustand para documento, selección, historial, estado sucio y estado de guardado. |
| Texto | `RichTextV1` con `format: 'plain'` y `value: string`. La tipografía se guarda como propiedades opcionales del componente; la edición de fragmentos enriquecidos sigue reservada para una fase posterior. |
| Distribución | Rejilla fija de 12 tracks, `SpanIntent` por breakpoint, auto-placement de CSS Grid y `subgrid` solo en columnas de lienzos anidados. Posición y tamaño por celdas en ambos ejes. |
| Limpieza | Sistema paralelo y removable; el editor actual sigue intacto hasta una decisión futura de sustitución. |
| Acceso | Ocultar la tarjeta de entrada a quien no sea la cuenta autorizada. Sin bloqueo fuerte de ruta ni evento `route_denied` nuevo por ahora. |
| Versiones | Borrador editable, versiones inmutables, versión pública activa y publicación atómica. |
| Navegación | Replantear de cero: búsqueda inmediata, recientes, ruta compartible y sin selector a pantalla completa. |

---

## 2. Alcance de Fase 1

### 2.1 Incluido

- Ruta paralela `/editor-paginas-v2` y ruta pública de vista previa `/vista-v2/:pageKey`.
- Tarjeta nueva en `src/pages/Edicion.tsx`, visible solo para la sesión autorizada.
- Índice propio de páginas con búsqueda, filtros por sección, recientes y continuación rápida.
- Lienzo con rejilla de 12 columnas y primitivos `heading`, `text`, `image` y `canvas` anidado de un nivel.
- Texto plano, imagen desde R2 existente o subida por los servicios actuales, y distribución responsive por contenedor.
- Guardado de borrador, historial local de undo/redo, versiones inmutables y publicación atómica.
- Contrato Zod, adaptadores Puck, servicios Supabase v2 y renderizador v2 de solo Fase 1.
- SQL local de creación y SQL local de reversión, sin ejecutar en remoto sin autorización.

### 2.2 Expresamente excluido

- Modificar `EditorPaginas.tsx`, `PageContentEditor.tsx`, `ContentBlockRenderer.tsx`, `blockRegistry.ts` ni estilos del editor actual.
- Leer, migrar, borrar o reescribir las cuatro tablas `content_*` ni sus RPC.
- Sustituir las páginas públicas actuales por el renderizador v2. El cambio de lectura pública se hará en una fase posterior.
- Tokens de diseño, temas, panel de estilos, animaciones, Tiptap, Biome, React Compiler o subida de archivos a un proveedor distinto de R2.
- Borrado físico de imágenes. Los archivos retirados de un documento pueden seguir referenciados por versiones antiguas.

---

## 3. Arquitectura y puntos de contacto

### 3.1 Estructura nueva

```text
src/editor2/
  domain/
    types.ts              # CanvasDoc y uniones tipadas
    schema.ts             # esquemas Zod y migration guards
    layout.ts             # SpanIntent -> clases de rejilla
    defaults.ts           # defaultProps de primitivos
  adapters/
    puck.ts               # CanvasDoc <-> datos de Puck
  store/
    editor2Store.ts       # Zustand: doc, selección, historial, dirty, saveState
  services/
    editor2Api.ts         # únicas llamadas a RPC v2
    catalogIndex.ts       # lectura de solo lectura de temas/subtemas para navegación
    pageIndex.ts          # índice de páginas, jerarquía del catálogo y recientes
  navigation/
    PageSearch.tsx        # búsqueda y filtros
    PageBreadcrumb.tsx
  components/
    Editor2Canvas.tsx
    Editor2Blocks.tsx
    VersionDrawer.tsx
    SaveBar.tsx
  pages/
    Editor2Home.tsx
    Editor2Workspace.tsx
    Editor2PublicView.tsx
  render/
    Editor2Renderer.tsx   # mismo doc para vista previa y pública v2
  styles/
    editor2.css
```

### 3.2 Contactos mínimos con el resto de Atlas

| Archivo | Cambio previsto | Límite |
| --- | --- | --- |
| `src/App.tsx` | Importar con `lazy` los tres componentes nuevos y registrar tres rutas. | No tocar las rutas actuales. |
| `src/pages/Edicion.tsx` | Añadir una tarjeta nueva junto a la de «Editor de páginas». | No cambiar la tarjeta ni los botones actuales. |
| `src/security/editorV2Access.ts` | Predicado de visibilidad de tarjeta. | Solo comparación de correo normalizado; sin registro de eventos nuevos. |
| `database/editor2/001_setup.sql` | Creación local del esquema y las RPC. | No ejecutar en producción sin autorización. |
| `database/editor2/999_drop.sql` | Reversión completa de objetos v2. | No ejecutar como exploración. |
| `docs/guia-atlas.md` | Enlace a este plan. | Documentación únicamente. |

El predicado debe usar `user.username.trim().toLowerCase()` porque `AuthUser` no expone `email`; en Atlas, `username` es el correo de acceso. El valor de la cuenta autorizada se corrigió durante la Parte 3 en `src/security/editorV2Access.ts` y sus pruebas siguiendo la indicación del usuario. Se conserva la decisión de no copiar ese dato personal en este documento.

### 3.3 Rutas

```text
/editor-paginas-v2              -> Editor2Home: búsqueda, recientes, todas las páginas
/editor-paginas-v2/p/:pageKey   -> Editor2Workspace: lienzo + barra de estado + cajón de versiones
/vista-v2/:pageKey              -> Editor2PublicView: solo versión publicada, sin sesión
```

`pageKey` es opaco y estable: `home`, `creditos`, `temario`, `tema-12`, `subtema-87`. La versión observable se pasa como `?version=<id>` para que un enlace pueda abrir una revisión concreta. Los recientes y preferencias de interfaz viven en `localStorage`; el contenido no.

Las dos rutas de edición usan el mismo criterio de roles que `/editor-paginas`: Administrador o Microscopía. No se añade `allowedUserIds`, no se registra `route_denied` y no se redirige a acceso denegado por correo. La ocultación es solo de la tarjeta.

---

## 4. Modelo de contenido

### 4.1 Formato persistido

```ts
type RichTextV1 = { format: 'plain'; value: string };

type SpanValue = number; // validado por Zod entre 1 y 12

type SpanIntent = {
  span: SpanValue;
  start?: number; // columna inicial, 1..12
  row?: number; // fila inicial, 1..500; ausente = automática
  rowSpan?: number; // alto en celdas, 1..12; ausente = automático
};

type LayoutIntent = {
  base: SpanIntent;
  md?: SpanIntent;
  lg?: SpanIntent;
};

type HeadingBlock = {
  id: string;
  type: 'heading';
  props: { level: 1 | 2 | 3; text: RichTextV1 };
};

type TextBlock = {
  id: string;
  type: 'text';
  props: { text: RichTextV1 };
};

type ImageBlock = {
  id: string;
  type: 'image';
  props: { src: string; alt: string; caption?: RichTextV1 };
};

type CanvasNode = {
  id: string;
  type: 'canvas';
  props: { gap: 'sm' | 'md' | 'lg'; depth: 0 | 1 };
  slots: { children: PlacedBlock[] };
};

type PlacedBlock = {
  block: HeadingBlock | TextBlock | ImageBlock | CanvasNode;
  layout: LayoutIntent;
};

type CanvasDoc = {
  schemaVersion: 1;
  pageKey: string;
  root: CanvasNode;
};
```

Un subtítulo es `heading` con `level: 3`; no se crea un tipo nuevo. Los IDs son UUID generados al insertar. Todo bloque lleva su `layout`, incluso dentro de un lienzo anidado.

### 4.2 Reglas de distribución y render

- El lienzo raíz usa `display: grid`, `grid-template-columns: repeat(12, minmax(0, 1fr))` y `container-type: inline-size`.
- Los breakpoints son de contenedor, no de viewport: `base`, `md` y `lg`.
- `layout.ts` produce clases estáticas deterministas: `e2-span-base-6`, `e2-start-md-2`, `e2-span-lg-4`. Se generan las 12 combinaciones por breakpoint en CSS; no se inyecta CSS arbitrario.
- Si `start` está ausente, se omite `grid-column-start` y CSS Grid coloca el bloque en el primer hueco libre del orden DOM.
- Un lienzo anidado ocupa `grid-column: 1 / -1` y aplica `grid-template-columns: subgrid` para alinear sus columnas con el padre.
- Profundidad máxima 1 en Fase 1. `subgrid` no se usa fuera de ese caso.
- La raíz solo admite bloques de estructura. Cada bloque solo admite componentes de contenido y muestra una cuadrícula bidimensional sin numeración durante la edición. El inspector permite marcar un rectángulo por arrastre en un selector con ejes numerados y guías centrales o indicar la fila, columna, ancho y alto por breakpoint. La vista previa aplica la distribución sin las guías. Los documentos anteriores conservan la colocación automática cuando faltan las coordenadas.
- El renderizador v2 pinta texto como nodos de texto, nunca como HTML. Las imágenes exigen `src` HTTPS y `alt`.

### 4.3 Validación

- `schema.ts` es la única fuente de verdad del contrato. Zod valida al cargar borrador, al recibir una versión, al convertir desde Puck y antes de llamar a cualquier RPC de escritura.
- Un `schemaVersion` distinto de 1 no se convierte en silencio: se muestra un estado de documento incompatible y se bloquea el guardado hasta una migración explícita.
- Campos desconocidos se rechazan en Fase 1. No existe el `Record<string,string>` heredado ni normalización permisiva.

---

## 5. Integración con Puck

Puck se usa como motor de interacción, no como base de datos. El documento guardado siempre es `CanvasDoc`.

```text
CanvasDoc -> fromCanvasDoc() -> Puck data -> Puck edita -> toCanvasDoc() -> Zod -> RPC
```

| Puck | Uso en v2 |
| --- | --- |
| `component` | `heading`, `text`, `image`, `canvas`. |
| `slot` | Solo `canvas.slots.children`. Es el único objetivo de drop. |
| `allow` | La raíz admite solo `canvas`; el bloque admite `heading`, `text` e `image`. |
| `disallow` | Se usa para impedir soltar un `canvas` dentro de otro en profundidad 1. |
| `defaultProps` | Valores iniciales de cada primitivo, incluido el `SpanIntent` base. |
| `inline` + `puck.dragRef` | Asa de arrastre dentro de la tarjeta, sin grandes zonas de arrastre que secuestren el texto. |

Reglas de conversión:

1. El orden del array `slots.children` es el orden DOM y, por tanto, el orden de auto-placement.
2. El adaptador elimina metadatos internos de Puck que no pertenezcan a `CanvasDoc`.
3. La selección de Puck se refleja en Zustand solo para resaltar el inspector; no se persiste.
4. Si Puck produce un dato inválido, se conserva el último `CanvasDoc` válido y se muestra un error recuperable.

---

## 6. Navegación rediseñada

### 6.1 Diagnóstico que se corrige

El flujo actual obliga a pasar por selector a pantalla completa, workspace, explorador lateral y hub de versiones antes de editar. El selector lateral consume ancho, los filtros no recuerdan intención y la versión parece una pantalla distinta. El 2.0 elimina esas capas.

### 6.2 Pantalla de entrada: `Editor2Home`

Una sola pantalla compacta, sin ocupar toda la pantalla:

1. **Buscador principal**, enfocado al abrir. Busca por título, sección, `pageKey`, ruta pública y palabras clave normalizadas sin acentos.
2. **Continuar**, una tarjeta con la última página abierta y su estado: borrador guardado, cambios pendientes o versión pública.
3. **Recientes**, hasta cinco páginas con última edición y etiqueta de estado.
4. **Todas las páginas**, lista agrupada por sección con chips derivados del índice: `Todas`, `Inicio`, `Temario` y `Créditos`. Dentro de `Temario`, los temas aparecen con sus subtemas anidados y un control para colapsarlos.
5. Cada fila muestra título, sección, ruta pública, estado y acción primaria `Editar`; acción secundaria `Ver pública` solo si existe publicación.

Interacción:

- `Ctrl/⌘ + K` enfoca el buscador desde cualquier pantalla del editor v2.
- Flechas y `Enter` abren el resultado activo; `Escape` limpia la búsqueda.
- Un clic abre directamente el workspace. No hay paso intermedio de confirmación.
- La URL de la página abierta es compartible y sobrevive a recarga.

### 6.3 Workspace

- Breadcrumb: `Páginas / Sección / Página`, con los dos primeros niveles enlazados al índice filtrado.
- Barra superior: estado de guardado, estado de publicación, `Historial`, `Vista pública`, `Guardar`.
- El historial es un cajón lateral superpuesto, no una pantalla que desmonta el lienzo.
- El buscador de páginas sigue accesible con `Ctrl/⌘ + K`; no hay navegador lateral permanente.
- Cambiar de página con cambios sin guardar usa el mismo diálogo de salida del 2.0: cancelar, guardar y salir, o salir sin guardar.

### 6.4 Índice de páginas

`editor2.pages` es un registro propio, no una FK a `temas` o `subtemas`. La Fase 1 incluye una acción `Actualizar índice` que lee catálogo de solo lectura y guarda copias de título, sección, ruta y orden. Eso permite:

- listar páginas dinámicas sin depender de tablas del editor actual;
- conservar el índice aunque cambie el catálogo;
- borrar el esquema v2 sin dejar huellas en catálogo.

El contenido de una página nunca se deriva del catálogo; solo sus metadatos de navegación.

**Estado en la Parte 3:** todavía no existe `editor2.pages` ni la acción `Actualizar índice`. Mientras tanto, `catalogIndex.ts` consulta `temas` y `subtemas` en modo de solo lectura y `pageIndex.ts` compone el índice con páginas fijas (`home`, `temario`, `creditos`) más `tema-<id>` y `subtema-<id>`. Si falla esa lectura, se conservan las páginas fijas y se muestra un aviso; no se toca el contenido ni se crea nada en remoto.

---

## 7. Persistencia Supabase v2

### 7.1 Elección

Se crea un **esquema PostgreSQL `editor2` dentro del mismo proyecto Supabase de Atlas**. Es una base de datos lógica nueva, separada y removable. No se crea un proyecto Supabase nuevo porque obligaría a replicar sesiones, claves y despliegue sin beneficio para Fase 1.

Todas las operaciones pasan por RPC en `public` que acceden a `editor2.*` con `search_path` fijo. No se otorga acceso directo de lectura o escritura a las tablas para `anon` ni `authenticated`. Las tablas tienen RLS activado como defensa adicional.

### 7.2 Tablas

| Tabla | Clave | Contenido |
| --- | --- | --- |
| `editor2.pages` | `page_key` | Título, sección, `public_path`, palabras clave, orden, enabled, fechas. Copia de metadatos; sin FK a catálogo. |
| `editor2.versions` | `id`, único `(page_key, version_number)` | Número, etiqueta, `doc` JSONB inmutable, origen (`draft`, `version`, `empty`), autor y fecha. |
| `editor2.drafts` | `page_key` | `doc` editable, `base_version_id` opcional hacia `versions`, autor y fecha. |
| `editor2.publications` | `page_key` | `version_id` hacia `versions`, autor y fecha. Una sola fila por página. |
| `editor2.audit` | `id` | `page_key`, acción, `version_id`, `actor_id`, detalle JSONB y fecha. Sin nombres ni correos. |

`actor_id` se copia de la sesión de Atlas como entero. No se crea FK a `usuarios` para que el esquema siga siendo removible.

### 7.3 RPC en `public`

| RPC | Acción |
| --- | --- |
| `editor2_list_pages` | Devuelve páginas con estado de borrador y versión pública. |
| `editor2_upsert_pages` | Inserta o actualiza metadatos de índice. Solo roles de edición. |
| `editor2_get_workspace` | Devuelve borrador, resumen de versiones y publicación. |
| `editor2_save_draft` | Valida sesión y esquema mínimo; hace upsert del borrador; registra auditoría. |
| `editor2_create_version` | Copia el borrador o una versión a una versión nueva inmutable. |
| `editor2_publish_draft` | Crea versión desde el borrador y mueve el puntero público en una transacción. |
| `editor2_publish_version` | Publica una versión existente en una transacción. |
| `editor2_delete_version` | Borra una versión que no sea la pública. |
| `editor2_get_public_doc` | Sin sesión. Devuelve `doc` y `version_id` solo si existe publicación. Nunca lee `drafts`. |

Todas las RPC de escritura llaman a un auxiliar privado `editor2_assert_session` que valida `X-Atlas-Session` mediante el modelo propio de sesiones y exige rol Administrador o Microscopía. La verificación por correo solo gobierna la tarjeta; no se usa como autorización de servidor en Fase 1.

### 7.4 Flujo de publicación

```text
Borrador editable
  -> editor2_publish_draft(pageKey, label)
  -> transacción: bloquear fila de draft, validar doc, insertar versión,
     upsert de publications, insert de auditoría
  -> /vista-v2/:pageKey lee esa versión por su id
  -> seguir editando el borrador NO cambia la vista pública
```

La caché pública, si se añade, usa `pageKey + versionId` como clave. No existe ruta que consulte `drafts` para mostrar contenido público. Si falta la publicación, `Editor2PublicView` muestra un estado vacío explícito.

### 7.5 Archivos SQL y protección de producción

- Creación: `database/editor2/001_setup.sql`.
- Reversión: `database/editor2/999_drop.sql`.
- Ambos se preparan localmente y se revisan antes de cualquier ejecución.
- No ejecutar scripts, reinicios ni migraciones en producción sin respaldo verificado y autorización explícita para esa operación concreta.
- Antes de aplicar, comprobar que no existen objetos `editor2` previos y contrastar la definición vigente de validación de sesión.
- Después de aplicar, verificar por lectura: tablas creadas, RLS activo, privilegios de RPC, rechazo sin sesión y ausencia de filas reales modificadas fuera del sistema v2.

---

## 8. Servicios y estado del cliente

### 8.1 Zustand

`editor2Store.ts` expone:

- `doc: CanvasDoc | null`;
- `selection: string | null`;
- `dirty: boolean`;
- `saveState: 'idle' | 'saving' | 'saved' | 'error'`;
- `history: CanvasDoc[]` e `future: CanvasDoc[]`, con límite de 100 estados;
- acciones puras: `setDoc`, `selectBlock`, `updateBlock`, `moveBlock`, `setSpan`, `undo`, `redo`, `markSaved`.

El autosave se dispara 3 segundos después del último cambio y comparte una sola promesa. Guardar manualmente espera autosave en curso y guarda cambios posteriores, para no perder la última edición.

### 8.2 Servicios

`editor2Api.ts` es el único módulo que llama a RPC v2. Ningún componente consulta Supabase directamente. Cada respuesta se parsea con Zod antes de entrar al store. Los errores distinguen sesión inválida, validación de documento, conflicto de versión y fallo de red.

`pageIndex.ts` mantiene en memoria el resultado de `editor2_list_pages`. La búsqueda no genera petición por tecla. Los recientes se guardan en `localStorage` con clave `atlas-editor2-recent-v1`; si el almacenamiento falla, la navegación sigue funcionando.

---

## 9. Criterios de aceptación

### 9.1 Acceso y navegación

- La tarjeta nueva aparece solo para la sesión autorizada; para el resto de sesiones no existe en `Edicion.tsx`.
- La tarjeta actual «Editor de páginas» sigue visible con las mismas reglas que antes.
- Un usuario sin la cuenta autorizada que escriba la URL directamente queda sujeto a los roles habituales; no se añade bloqueo por correo en esta fase.
- Desde la tarjeta se llega al buscador; escribir un término filtra sin recargar; `Enter` abre la página.
- La URL de una página abierta puede copiarse, pegarse en otra pestaña y reabrir el mismo documento.
- Recientes y breadcrumb permiten volver al índice en un clic.

### 9.2 Edición

- Se pueden insertar, seleccionar, mover, duplicar y borrar `heading`, `text`, `image` y un `canvas` anidado.
- El texto plano se guarda y se vuelve a cargar sin HTML ni formatos fantasma.
- Una imagen admite URL R2 existente o subida por el servicio actual; muestra alt y pie opcional; no se borran archivos.
- El `SpanIntent` se puede cambiar por breakpoint y el resultado se ve con container queries a 360, 768 y 1280 px de ancho de contenedor.
- Undo/redo funciona para inserción, borrado, movimiento y cambio de span.

### 9.3 Persistencia y versiones

- Guardar, recargar y volver a abrir conserva el mismo `CanvasDoc` validado.
- Un documento con `schemaVersion` desconocido se rechaza con mensaje claro; no se guarda parcialmente.
- Crear versión no cambia la pública. Publicar crea una versión nueva y actualiza el puntero atómicamente.
- Editar después de publicar deja `/vista-v2/:pageKey` exactamente igual hasta una nueva publicación.
- La versión pública no se puede borrar mientras siga siendo la activa.
- `editor2_get_public_doc` nunca devuelve un borrador, aunque la tabla `drafts` tenga cambios recientes.

### 9.4 Aislamiento

- Ningún archivo bajo `src/editor2/` importa `EditorPaginas`, `PageContentEditor`, `ContentBlockRenderer`, `blockRegistry` ni servicios `content*`.
- Ninguna RPC v2 lee o escribe tablas `content_*`.
- Después de desinstalar el sistema v2, `/editor-paginas` sigue funcionando igual.

---

## 10. Pruebas y comprobaciones

| Nivel | Pruebas previstas |
| --- | --- |
| Contrato | Zod acepta docs válidos y rechaza tipos desconocidos, spans fuera de rango y versiones no soportadas. |
| Layout | `SpanIntent` produce las clases correctas; auto-placement y subgrid se comprueban con HTML representativo. |
| Adaptadores | Idas y vueltas `CanvasDoc <-> Puck` sin perder IDs, orden ni layout. |
| Acceso | `editorV2Access` devuelve visible solo para el correo normalizado configurado. |
| Navegación | Búsqueda con acentos, filtros, recientes, teclado y URL compartible. |
| Store | Undo/redo, dirty, autosave compartido y error de guardado recuperable. |
| Servicios | RPC simuladas: guardado, creación de versión, publicación atómica y vista pública sin fallback. |
| Render | Los tres primitivos y el lienzo anidado se pintan igual en vista previa y pública v2. |
| Navegador aislado | Recorrido completo con peticiones simuladas: entrada, búsqueda, edición, guardado, versión, publicación y vista pública. |

Comandos previstos al terminar la implementación:

```text
npm test -- src/editor2
npm test -- src/security/editorV2Access.test.ts
npm run typecheck
npm run build
```

No se considerará verificada la creación real de esquemas, RPC ni permisos hasta que se ejecute una comprobación acotada con autorización.

---

## 11. Plan de ejecución por partes

La Fase 1 se ejecuta en ocho partes pequeñas. Cada parte termina con una comprobación local y una pausa para revisión del usuario. No se avanza a la siguiente hasta que la anterior esté aceptada.

**Regla de trabajo:** en cada parte se permite tocar solo los archivos listados en esa parte. Si aparece una corrección, se aplica dentro de la parte activa antes de continuar.

### Parte 0 — Documento base

**Estado:** completada.

**Archivos:**
- `docs/revisiones/editor-paginas-v2-fase1-plan.md`.
- `docs/guia-atlas.md`.

**Resultado:** plan guardado, enlazado y sin código de implementación.

---

### Parte 1 — Cimientos de tipos y contrato

**Objetivo:** fijar el modelo de datos y sus validaciones sin interfaz ni Supabase.

**Archivos:**
- `package.json`: añadir Puck, Zod y Zustand si no existen.
- `src/editor2/domain/types.ts`.
- `src/editor2/domain/schema.ts`.
- `src/editor2/domain/defaults.ts`.
- `src/editor2/domain/layout.ts`.
- `src/editor2/domain/*.test.ts`.

**Incluye:**
- `RichTextV1`, `SpanIntent`, `LayoutIntent`, bloques, `CanvasNode` y `CanvasDoc`.
- Esquemas Zod y rechazo de `schemaVersion` desconocido.
- Valores por defecto de los primitivos.
- Resolución de `SpanIntent` a clases CSS deterministas.
- Pruebas unitarias de contrato y layout.

**No incluye:** rutas, tarjeta, Puck montado, store con historial, RPC ni SQL.

**Comprobación al terminar:**
- `npm test -- src/editor2/domain`
- `npm run typecheck`
- `npm run build`

**Pausa de revisión:** revisar forma del `CanvasDoc`, nombres de tipos, breakpoints y clases de rejilla.

---

### Parte 2 — Store, adaptadores y accesibilidad de entrada

**Objetivo:** dejar el estado del editor y el predicado de tarjeta listos, todavía sin pantalla real.

**Archivos:**
- `src/editor2/store/editor2Store.ts`.
- `src/editor2/store/editor2Store.test.ts`.
- `src/editor2/adapters/puck.ts`.
- `src/editor2/adapters/puck.test.ts`.
- `src/security/editorV2Access.ts`.
- `src/security/editorV2Access.test.ts`.

**Incluye:**
- Zustand con documento, selección, `dirty`, estado de guardado, historial y undo/redo.
- Conversiones `CanvasDoc <-> Puck`, sin usar Supabase.
- Predicado de visibilidad basado en `user.username.trim().toLowerCase()`.
- Pruebas de ida y vuelta del adaptador y del predicado.

**No incluye:** tarjeta en `Edicion.tsx`, rutas en `App.tsx`, router ni Puck renderizando.

**Comprobación al terminar:**
- `npm test -- src/editor2/store src/editor2/adapters src/security/editorV2Access.test.ts`
- `npm run typecheck`
- `npm run build`

**Resultado:** 23 pruebas pasadas (7 de adaptador, 13 de store y 3 de acceso), tipado y build correctos. El store mantiene 100 estados de historial, undo/redo, `dirty` y estados de guardado. El movimiento entre contenedores respeta el índice destino y se impide insertar un lienzo dentro de otro lienzo.

**Pausa de revisión:** revisar historial, límites de undo/redo, manejo de dirty y forma del adaptador.

---

### Parte 3 — Navegación y entrada desde Edición

**Objetivo:** poder entrar, buscar y abrir una página ficticia sin persistencia remota.

**Archivos:**
- `src/App.tsx`: imports `lazy` y ruta `/editor-paginas-v2` únicamente.
- `src/pages/Edicion.tsx`: tarjeta nueva condicionada por el predicado.
- `src/editor2/services/catalogIndex.ts`: lectura acotada y validada de `temas`/`subtemas`.
- `src/editor2/services/pageIndex.ts`.
- `src/editor2/navigation/PageSearch.tsx`.
- `src/editor2/navigation/PageBreadcrumb.tsx`.
- `src/editor2/pages/Editor2Home.tsx`.
- `src/editor2/pages/Editor2Workspace.tsx` como placeholder.
- `src/editor2/styles/editor2.css` solo para esta pantalla.
- Pruebas de navegación, catálogo y tarjeta.

**Incluye:**
- Tarjeta oculta para cuentas no autorizadas; corrección del correo autorizado en el predicado y sus pruebas.
- Buscador principal, filtros por sección, recientes y breadcrumb.
- Índice con páginas fijas más temas y subtemas del catálogo, jerarquía colapsable y búsqueda que conserva el tema padre.
- Aviso recuperable si falla la lectura del catálogo, sin perder las páginas fijas.
- URL `/editor-paginas-v2/p/:pageKey` apuntando al placeholder; el subtema muestra el tema padre en el breadcrumb.
- Recientes en `localStorage` sin contenido.

**No incluye:** lienzo, Puck montado, guardado ni RPC.

**Comprobación al terminar:**
- `npm test -- src/editor2 src/pages/Edicion.editor2.test.tsx src/security/editorV2Access.test.ts`
- `npm run typecheck`
- `npm run build`
- `npm run design:check`

**Resultado:** 74 pruebas pasadas en 10 archivos (`src/editor2`, `src/pages/Edicion.editor2.test.tsx` y `src/security/editorV2Access.test.ts`), tipado y build correctos y `design:check` en PASS. Tras la primera revisión del usuario, la pantalla se rediseñó con dirección propia: barra de mando central, filtros segmentados, árbol de temario en lista única con filas divisibles, chevron animado, recientes compactos arriba y microinteracciones sobrias (curva `ease-out` propia, `:active` con escala, `prefers-reduced-motion`). La navegación muestra temas y subtemas del catálogo con jerarquía colapsable; la búsqueda sin acentos arrastra el tema padre cuando coincide un subtema; el breadcrumb del workspace enlaza al tema; recientes y URL compartible siguen funcionando. Si falla el catálogo, se avisa y quedan las tres páginas fijas. La tarjeta aparece solo para la cuenta autorizada con permiso de edición; las rutas nuevas quedan tras `PrivateRoute` con roles Administrador y Microscopía. La verificación visual en navegador sigue pendiente: sin sesión autenticada, `PrivateRoute` redirige a `/`. No se aplicó ningún bypass de autenticación.

**Segundo rediseño (17 de noviembre de 2026):** el usuario volvió a rechazar la interfaz por poco práctica. Se sustituyó la barra de mando y el árbol largo por un **explorador de dos paneles**:

- Riel lateral fijo con marca, buscador tipo comando (`Ctrl K`), páginas base y temario completo agrupado por parcial, con numeración mono y conteo de subtemas.
- Área principal con recientes compactos arriba y el tema activo siempre visible: cabecera con parcial y número, acción «Abrir tema» y subtemas en tarjetas de dos columnas.
- La búsqueda y los filtros de sección pasan al área principal como panel de resultados; en exploración las flechas recorren temas y en resultados recorren coincidencias, con `Enter` para abrir.
- Estética alineada al sitio: `#0b2545`, `#57708f`, `#0284c7`, `#0369a1`, `#e0f2fe`, `#06b6d4`, radios 18–20 px, Montserrat + IBM Plex Mono y curva `cubic-bezier(0.16, 1, 0.3, 1)`.
- Responsive: a 900 px el riel pasa a rejilla de dos columnas de temas con títulos completos (sin truncarlos a «Tejido c…»); a 640 px se compactan tipografía y numeración. Recientes con `scroll-snap`. Se respeta `prefers-reduced-motion`.
- El ancho se controla dentro de `main` con `.e2-home-page`, porque la regla global de `style.css` fuerza `max-width: 1600px` con `!important`.
- Se corrigieron los avisos propios: degradado superior azul→cian sin violeta y `rel="noopener noreferrer"` en el enlace externo.

La verificación visual se hizo con un harness temporal aislado (datos simulados, CSS real) a 1280 px y 390 px, sin sesión; el harness se retiró al terminar. Queda pendiente que el usuario abra `/editor-paginas-v2` con sesión iniciada y revise también el workspace.

**Pausa de revisión:** revisar el aspecto visual de la navegación, densidad, filtros, atajos y comportamiento de la tarjeta.

---

### Parte 4 — Lienzo y primitivos con Puck

**Objetivo:** editar un documento en memoria con arrastre, slots y rejilla de 12 columnas.

**Archivos:**
- `src/App.tsx`: ruta `/editor-paginas-v2/p/:pageKey` deja de ser placeholder.
- `src/editor2/components/Editor2Canvas.tsx`.
- `src/editor2/components/Editor2Blocks.tsx`.
- `src/editor2/components/SaveBar.tsx`.
- `src/editor2/pages/Editor2Workspace.tsx`.
- `src/editor2/render/Editor2Renderer.tsx`.
- Estilos de rejilla y primitivos.
- Pruebas de interacción y render.

**Incluye:**
- Puck con `heading`, `text`, `image` y `canvas` anidado de un nivel.
- Slots solo en canvas, `allow`/`disallow` según profundidad.
- `inline` + `puck.dragRef`.
- Rejilla de 12 tracks, spans por breakpoint, auto-placement y subgrid en columnas.
- Vista previa en memoria del mismo documento.

**No incluye:** llamadas a Supabase, autosave real ni vista pública.

**Comprobación al terminar:**
- `npm test -- src/editor2 src/pages/Edicion.editor2.test.tsx src/security/editorV2Access.test.ts`
- `npm run typecheck`
- `npm run build`
- `npm run design:check`
- Revisión en navegador a 360, 768 y 1280 px de ancho de contenedor.

**Resultado:** 111 pruebas pasadas en 14 archivos (`src/editor2`, `src/pages/Edicion.editor2.test.tsx` y `src/security/editorV2Access.test.ts`), tipado, build y `design:check` en PASS. Se amplió el lienzo a 24 columnas (`schemaVersion: 2`) con escala proporcional ligada al ancho del contenedor (`cqw`), menú superior organizado en 3 categorías (**Estructura**: `Bloque de página`, `Pestañas`, `Acordeón`; **Contenido**: `Título`, `Párrafo`, `Nota / Aviso`, `Tabla`, `Botón`, `Separador`; **Multimedia**: `Imagen`, `Carrusel`, `Comparador`, `GIF`, `Video`), edición directa en vivo sobre el lienzo sin superposición del control de arrastre, selección de imágenes del Atlas con filtro por Tema/Subtema/búsqueda y subida a Cloudflare R2 (preservando animación en GIF), selector de páginas internas del Atlas en `Botón`, botón de eliminar visible en todos los bloques, atajos de teclado (`Supr`, `Ctrl+D`, `Ctrl+Z`, `Ctrl+Y`) y anidamiento bidireccional entre `Estructura` y `Bloque de página`.

**Pausa de revisión:** Parte 4 cerrada y lista para avanzar a Parte 5.

---

### Parte 5 — SQL local y persistencia sin activación remota

**Objetivo:** preparar la base de datos v2 y sus servicios sin ejecutar nada en Supabase.

**Archivos:**
- `database/editor2/001_setup.sql`.
- `database/editor2/999_drop.sql`.
- `src/editor2/services/editor2Api.ts`.
- `src/editor2/services/editor2Api.test.ts`.
- `src/editor2/services/pageIndex.ts` deja de usar mocks.
- Pruebas con RPC simuladas.

**Incluye:**
- Esquema `editor2`, cinco tablas y RPC listadas en la sección 7.
- Reversión completa.
- Cliente tipado y validado con Zod.
- Guardado de borrador y carga de workspace con mocks.

**No incluye:** ejecución remota, cambio de tarjetas ni publicación.

**Comprobación al terminar:**
- `npm test -- src/editor2/services`
- `npm run typecheck`
- `npm run build`
- Revisión manual del SQL y del rollback.

**Pausa de revisión:** revisar nombres de tablas/RPC, permisos, sesión, auditoría y rollback antes de pedir autorización remota.

---

### Parte 6 — Autosave, versiones y publicación atómica

**Objetivo:** cerrar el flujo completo de edición y publicación con mocks.

**Archivos:**
- `src/editor2/store/editor2Store.ts`: integración de guardado.
- `src/editor2/components/SaveBar.tsx`.
- `src/editor2/components/VersionDrawer.tsx`.
- `src/editor2/pages/Editor2Workspace.tsx`.
- `src/editor2/pages/Editor2PublicView.tsx`.
- `src/App.tsx`: ruta `/vista-v2/:pageKey`.
- Pruebas de store, servicios y vista pública.

**Incluye:**
- Autosave de 3 segundos con promesa compartida.
- Guardar manual.
- Crear versión desde borrador o desde versión.
- Publicar borrador o versión existente en transacción simulada.
- Cajón de historial sin desmontar el lienzo.
- Vista pública v2 con caché por `versionId` y sin fallback a borrador.

**No incluye:** ejecutar SQL remoto, sustituir Home/Temario/Subtemas/PlacasSubtema ni desplegar.

**Comprobación al terminar:**
- `npm test -- src/editor2`
- `npm run typecheck`
- `npm run build`
- Recorrido completo en navegador aislado con Supabase simulado.

**Pausa de revisión:** revisar por separado el guardado, las versiones, la publicación, la vista pública y la protección de cambios sin guardar.

---

### Parte 7 — Cierre, aislamiento y desinstalación

**Objetivo:** verificar que el sistema sea realmente paralelo y removible.

**Archivos:**
- Ajustes finales en cualquier archivo de las partes anteriores.
- `docs/revisiones/editor-paginas-v2-fase1-plan.md`: registrar resultados.
- `docs/guia-atlas.md`: actualizar estado si procede.

**Incluye:**
- Revisión de imports prohibidos desde `src/editor2/`.
- Revisión de que ninguna RPC v2 toca tablas `content_*`.
- Ejecución de todas las pruebas relacionadas.
- Tipado y compilación.
- Checklist de desinstalación ensayado en código, sin ejecutar SQL remoto.
- Documentación del estado final de Fase 1.

**No incluye:** publicación, push ni cambios en producción.

**Comprobación al terminar:**
- `npm test`
- `npm run typecheck`
- `npm run build`
- Revisión final del checklist de desinstalación.

**Pausa de revisión:** aceptación final de Fase 1 o correcciones antes de tocar el editor actual.

---

## 11.1 Estado actual de ejecución

| Parte | Estado |
| --- | --- |
| 0 — Documento base | Completada. |
| 1 — Cimientos de tipos y contrato | Completada y revisada: contrato Zod, defaults, layout y 19 pruebas. |
| 2 — Store, adaptadores y acceso | Completada y revisada: store con historial de 100, undo/redo, `dirty`, adaptador ida y vuelta y predicado por `username`; 23 pruebas, tipado y build. |
| 3 — Navegación y entrada | Completada con segundo rediseño: tarjeta gated con correo corregido, rutas protegidas, explorador de dos paneles con temario siempre visible, subtemas del tema activo, búsqueda tipo comando, recientes, breadcrumb jerárquico y workspace. |
| 4 — Lienzo y primitivos | Completada: rejilla de 24 columnas (`schemaVersion: 2`) con escala proporcional `cqw`, 3 estructuras (`Bloque de página`, `Pestañas`, `Acordeón`) y 11 componentes de contenido y multimedia (`Título`, `Párrafo`, `Nota / Aviso`, `Tabla`, `Botón`, `Separador`, `Imagen`, `Carrusel`, `Comparador`, `GIF`, `Video`), edición en vivo, catálogo del Atlas + subida a R2, atajos y borrado universal; 111 pruebas en 14 archivos, tipado, build y `design:check` PASS. |
| 5 — SQL local y persistencia | Completada localmente (sin ejecución remota): `database/editor2/001_setup.sql`, `database/editor2/999_drop.sql`, `src/editor2/services/editor2Api.ts` y `editor2Api.test.ts` (17 pruebas en `src/editor2/services`, tipado y build OK). |
| 6 — Autosave, versiones y publicación | Completada: autosave de 3 s con promesa compartida en `editor2Store.ts`, guardado manual, cajón `VersionDrawer.tsx` sin desmontar el lienzo, publicación atómica, `SaveBar.tsx` ampliado y ruta pública `/vista-v2/:pageKey` (`Editor2PublicView.tsx`) con caché por `versionId` y sin fallback a borrador. |
| 7 — Cierre y desinstalación | Completada: 0 imports prohibidos en `src/editor2/`, 0 referencias a `content_*` en `database/editor2/*.sql`, editor actual intacto, checklist de desinstalación verificado; `npm test` (110 archivos / 859 pruebas), `npm run typecheck`, `npm run build` y `npm run design:check` en PASS. |

Cada parte debe poder detenerse sin dejar el editor actual alterado. Las partes 1 a 4 y 6 se prueban con mocks; la parte 5 solo prepara SQL local; ninguna parte ejecuta objetos remotos sin autorización explícita.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| La forma interna de Puck filtre a la base de datos | Adaptadores obligatorios y Zod antes de cada escritura. |
| Auto-placement de Grid produce saltos inesperados | Posición opcional por celdas, orden DOM para la colocación automática y revisión por breakpoint. |
| La tarjeta oculta se confunda con autorización | RPC exigen sesión y roles; documento explica que no es bloqueo fuerte. |
| `username` no existe como `email` en `AuthUser` | Predicado usa `username` normalizado. |
| Caché sirva contenido anterior | Clave de caché con `versionId`; sin fallback a borrador. |
| Esquema personalizado no visible en Data API | No se depende de REST de tablas; solo RPC en `public`. |
| Usuarios con sesiones antiguas vean estados obsoletos | La revalidación de sesión actualiza la UI, como en el modelo actual. |
| Huérfanos de R2 | Fase 1 nunca borra archivos; limpieza futura revisará todas las versiones. |
| Dependencias nuevas queden huérfanas si se desinstala | Checklist de desinstalación incluye revisar Puck, Zod y Zustand en `package.json`. |

---

## 13. Checklist de desinstalación

1. Quitar la tarjeta nueva de `src/pages/Edicion.tsx`.
2. Quitar los `lazy` y las tres rutas de `src/App.tsx`.
3. Borrar `src/editor2/` y `src/security/editorV2Access.ts`.
4. Quitar dependencias nuevas solo si no tienen otro consumidor.
5. Aplicar `database/editor2/999_drop.sql` con autorización: primero RPC en `public`, después esquema `editor2`.
6. Confirmar que no quedan objetos `editor2_*` y que las tablas `content_*` están intactas.
7. Ejecutar pruebas relacionadas, tipado y compilación.
8. Conservar este documento como registro histórico; quitar solo el enlace de la guía si se decide así.

---

## 14. Autorizaciones pendientes

- No hay autorización para crear esquemas, tablas, RPC, políticas ni datos en Supabase.
- No hay autorización para publicar frontend ni desplegar Worker.
- La primera ejecución remota debe limitarse a un entorno o proyecto acordado, con respaldo verificado y alcance revisado.
- Este plan no modifica producción y no debe interpretarse como permiso para ejecutar `database/`.
