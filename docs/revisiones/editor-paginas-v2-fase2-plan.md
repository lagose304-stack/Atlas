# Editor de páginas 2.0 — Plan de Fase 2 (Estética, personalización máxima y UX intuitiva)

**Fecha del plan:** 18 de noviembre de 2026 (auditado para viabilidad técnica y paridad 1-a-1 con las 30 plantillas del editor v1).
**Estado:** **Fase 2 completada (Partes 1 a 7 cerradas y verificadas: 116 archivos / 886 pruebas globales en verde, aislamiento comprobado con 0 imports del editor v1 y 0 referencias a `content_*`, `typecheck`, `build` y `design:check` en PASS).** Sin push ni ejecución remota de `002_presets_templates.sql`.
**Referencias previas:**
- [Plan de Fase 1 (cerrado)](editor-paginas-v2-fase1-plan.md)
- [Inventario y diagnóstico del editor v1 (30 tipos)](editor-paginas-inventario-2026-11-17.md)

**Objetivo:** dotar al Editor de páginas 2.0 (`src/editor2/`) de todas las herramientas visuales necesarias para diseñar cualquier página **100 % sin código** —capaz de recrear y superar **cualquiera de las 30 plantillas del editor original**— mediante composición libre, sistema de temas y controles con **revelación progresiva** (rápidos e intuitivos en superficie, potencia máxima al desplegar).

---

## 0. Auditoría de viabilidad técnica (verificada sobre el repositorio)

Antes de cerrar este plan se revisaron `package.json`, `src/editor2/domain/schema.ts`, `src/editor2/adapters/puck.ts`, `src/editor2/render/Editor2Renderer.tsx` y `src/components/blocks/blockRegistry.ts`. Conclusiones clave:

| Área | Verificación en el repositorio | Decisión viable para Fase 2 |
| --- | --- | --- |
| **Dependencias npm** | Ya están instalados `@puckeditor/core`, `zod`, `zustand`, `@tiptap/react` + extensiones v3.20.4 (`color`, `highlight`, `link`, `text-style`, `underline`, `text-align`, `starter-kit`), `lucide-react` y `@tabler/icons-react`. | **0 dependencias nuevas** en toda la Fase 2. |
| **Contenedor `Tarjeta / Caja` (`box`)** | `schema.ts` usa esquemas Zod no-recursivos (`depth: 0` → `depth: 1` → hojas/`tabs`/`accordion`). Puck degrada el arrastre si hay recursión infinita. | Profundidad acotada y limpia: `box` se permite dentro de `Bloque de página`, `Pestañas` y `Acordeón`, y admite hasta **1 nivel de `box` dentro de `box`** (`boxDepth: 0 | 1`). Suficiente para cualquier tarjeta compleja sin riesgo de recursión ni pérdida de fluidez. |
| **Texto enriquecido por palabra** | Hacer un `contentEditable` casero con selección y rangos introduce bugs de cursor y foco. Tiptap v3 ya está en `package.json`. | Usar **Tiptap v3 encapsulado** únicamente dentro de `src/editor2/components/InlineRichText.tsx` (0 imports del editor v1), convirtiendo al contrato limpio y validado por Zod `RichTextV2` (sin `dangerouslySetInnerHTML`). |
| **Iconos médicos y generales** | `lucide-react` y `@tabler/icons-react` ya están instalados y tienen iconos científicos/médicos/UI vectoriales. | Catálogo curado de ~70 iconos en `IconPickerModal.tsx` con búsqueda en español insensible a acentos (sin importar `MedicalIconPickerModal` de v1). |
| **Ampliación de imagen (visor)** | `ImageBlock` ya tiene `zoom?: boolean`, pero `Editor2Renderer` aún no incluye lightbox y v1 no debe importarse. | Crear `Editor2Lightbox.tsx` propio y ligero (zoom, arrastre/pan, cierre por Escape/clic fuera) reutilizado por `Imagen`, `GIF`, `Carrusel` y `Comparador`. |
| **Alineación vertical y responsive** | `spanIntentSchema` ya soporta `verticalAlign` y `LayoutIntent` ya tiene `base`, `md`, `lg`, pero aún no están expuestos en la barra. | Exponer `verticalAlign` en el inspector y añadir selector de vista (`Escritorio` / `Tableta` / `Móvil`) + toggle *Apilar en móvil* (activo por defecto). |
| **Enlaces dinámicos de Atlas** | `Botón` ya tiene selector de **Página Atlas** (temas/subtemas), pero `weekly_test` y `exam_week` enlazan a evaluaciones. | Añadir pestaña **Evaluación Atlas** (lectura de solo lectura de pruebas publicadas) en el selector de enlaces de `Botón` y `RichTextV2`. *Nota honesta:* el carrusel automático en vivo `ExamWeekTestsCarousel` de `exam_week` es un widget con consulta en tiempo real; en Fase 2 se recrea su estética y botones directos a cada prueba, y en Fase 3 puede añadirse un bloque dinámico opcional de *Pruebas por parcial* si se desea mantener automático. |

---

## 1. Principios rectores de Fase 2

1. **Cero código, composición libre.** En lugar de 30 plantillas cerradas en TypeScript, el usuario combina bloques atómicos + contenedores (`Tarjeta / Caja`) + estilos universales + plantillas de sección 100 % editables.
2. **Máxima personalización sin abrumar (revelación progresiva):**
   - **Nivel 1 — Barra rápida (80 % de tareas en 1–2 clics):** controles esenciales del bloque seleccionado (color, tipografía, alineación, relleno rápido, borde rápido, brocha de copiar/pegar estilo).
   - **Nivel 2 — Inspector `Diseño` plegable (20 % avanzado bajo demanda):** degradados visuales con ángulo y paradas, imagen de fondo con overlay, bordes por lado (acentos laterales/superiores), radios por esquina, sombras personalizadas, glassmorphism (`backdrop-filter`), filtros de imagen, punto focal y animaciones. Oculto hasta que el usuario pulsa `Diseño`.
   - **Nivel 3 — Sistema de página (`Tema` y `Plantillas`):** cajones dedicados para cambiar la identidad visual de toda la página en 1 clic o insertar/guardar secciones reutilizables.
3. **Retrocompatibilidad estricta con Fase 1.** Todos los documentos guardados en Fase 1 (`schemaVersion: 2`) se abren, editan y renderizan intactos; las propiedades nuevas son opcionales o se normalizan automáticamente en Zod.
4. **Paridad 1:1 entre editor y vista pública.** Un único motor declarativo (`styleToCss`) traduce `BlockStyle` y `PageTheme` en el lienzo y en `Editor2Renderer` (`/vista-v2/:pageKey`).
5. **Aislamiento y reglas de Atlas intactas.** Cero imports del editor v1 (`EditorPaginas`, `ContentBlockRenderer`, `blockRegistry`, tablas `content_*`). Cloudflare R2 es el único almacenamiento multimedia. Todas las animaciones respetan `prefers-reduced-motion`. Sin `git push` ni ejecución automática de SQL remoto.

---

## 2. Verificación 1-a-1: las 30 plantillas del editor original

| # | Plantilla en editor v1 | Piezas en Editor 2.0 (Fase 1 + Fase 2) para recrearla 100 % sin código |
| --- | --- | --- |
| 1 | `heading` | `Título` (niveles 1–3) + `RichTextV2` (color, degradado/trazo, espaciado, alineación vertical). |
| 2 | `subheading` | `Título` (nivel 2/3) + estilos de `BlockStyle` y `PageTheme`. |
| 3 | `paragraph` | `Párrafo` + `RichTextV2` (formato por palabra, enlaces, sub/superíndice, alineación vertical). |
| 4 | `list` | `Párrafo` con listas de viñetas/numeradas y **estilo/color de viñeta** (punto, check, flecha, círculo numerado). |
| 5 | `callout` | `Nota / Aviso` + `BlockStyle` (borde lateral grueso, fondo suave/cristal, icono elegible, `RichTextV2`). |
| 6 | `weekly_publication` | `Bloque de página` (fondo degradado/lámina esmerilada) + `Tarjeta / Caja` + `Imagen` con **`overlayBadge`** y **visor** + `Insignia` + `Botón` con enlace a **Página Atlas** (temas/subtemas). Disponible también como plantilla 1-clic. |
| 7 | `exam_week` | `Bloque de página` + `Tarjeta / Caja` + `Insignia` (parcial) + `Imagen`/`Icono` + dos `Botón` enlazados a **Evaluación Atlas** / **Página Atlas**. *(Carrusel automático en vivo por parcial reservado como widget opcional de Fase 3).* |
| 8 | `weekly_test` | `Tarjeta / Caja` estilizada + `Insignia` + `Título`/`Párrafo` + `Botón` con selector directo a **Evaluación Atlas**. |
| 9 | `image` | `Imagen` con relación de aspecto, `objectPosition` (punto focal), radio, borde, sombra, filtros, `overlayBadge`, pie estilizable y **visor ampliado** (`Editor2Lightbox`). |
| 10 | `text_image` | `Párrafo` + `Imagen` lado a lado en la rejilla de 24 columnas con **`verticalAlign`** (`start` / `center` / `end`) y `gap` configurable. |
| 11 | `two_images` | Dos `Imagen` lado a lado en 24 columnas (cualquier proporción: 12+12, 16+8, 15+9, etc.) con aspecto y marco iguales mediante Copiar/Pegar estilo. |
| 12 | `three_images` | Tres `Imagen` en rejilla 24 columnas (8+8+8 iguales, 14+10 destacada o historia vertical) sin limitarse a 3 layouts fijos. |
| 13 | `carousel` | `Carrusel` con **autoplay, intervalo (s), flechas, puntos, aspecto, `objectPosition`, filtros, radio/sombra y visor ampliado** (sin límite de 8 fotos). |
| 14 | `text_carousel` | `Párrafo` + `Carrusel` lado a lado en 24 columnas con `verticalAlign`. |
| 15 | `double_carousel` | Dos `Carrusel` lado a lado en 24 columnas con proporción libre. |
| 16 | `section` | `Bloque de página` con `BlockStyle` (fondo, **`maxWidth`**, **borde izquierdo de guía lateral**, padding, sombra) + cabecera opcional. |
| 17 | `section_end` | Innecesario como bloque artificial: cada `Bloque de página` delimita visual y estructuralmente su propia sección. |
| 18 | `columns_2` | Rejilla nativa de 24 columnas con 2, 3, 4 o más `Tarjeta / Caja` con proporción libre y `verticalAlign`. |
| 19 | `topic_divisions` | `Pestañas` con **subtítulo opcional por pestaña**, color de acento y **estilo de navegación** (`underline`, `pills`, `cards` estilo Temario). |
| 20 | `divider` | `Separador` (horizontal/vertical, sólido, punteado, degradado, grosor, ancho, espacio y **etiqueta centrada**). |
| 21 | `histology_generalities` | `Bloque de página` + 3 `Tarjeta / Caja` en rejilla + `Insignia` + `Imagen` con `overlayBadge` + `Nota / Aviso` (consejo de laboratorio). Plantilla 1-clic incluida. |
| 22 | `histology_pillars` | 3 `Tarjeta / Caja` con borde superior/lateral de color + `Icono` médico + `Insignia` + `Imagen` + listas con viñetas. Plantilla 1-clic incluida. |
| 23 | `histology_stains` | `Tarjeta / Caja` por tinción + **`Insignia` variante `Muestra de color` (colorimetría)** + `Imagen` de muestra con visor + `Nota / Aviso`. Plantilla 1-clic incluida. |
| 24 | `histology_text_cards` | `Párrafo` + cuadrícula libre de `Tarjeta / Caja` con `Icono`, título y texto. |
| 25 | `histology_text_table` | `Título`/`Párrafo` + `Insignia` + **`Tabla` estilizada** (color de cabecera, filas cebra, bordes y densidad). Plantilla 1-clic incluida. |
| 26 | `histology_text_simple_cards` | `Título`/`Párrafo` + cuadrícula libre (2–4+ columnas) de `Tarjeta / Caja` simples. |
| 27 | `histology_bullet_cards` | `Título`/`Párrafo` + `Tarjeta / Caja` con **listas de viñetas estilizadas** (check/punto/flecha coloreado). |
| 28 | `histology_horizontal_cards` | `Tarjeta / Caja` horizontal (rejilla interna) con `Insignia` de color + subtítulo + descripción + `verticalAlign: 'center'`. |
| 29 | `histology_extra_data` | `Tarjeta / Caja` destacada con borde de acento + `Icono` + `Título`/`Párrafo` + `Imagen` opcional con pie y visor. Plantilla 1-clic incluida. |
| 30 | `weekly_histology_facts` | `Tarjeta / Caja` + `GIF`/`Imagen`/`Icono` + **`Acordeón` modo `Revelar pista`** (desplegable limpio tipo "Ver pista / respuesta"). Plantilla 1-clic incluida. |

---

## 3. Arquitectura visual y de datos (`src/editor2/`)

### 3.1 Extensión retrocompatible del contrato (`domain/`)
- **`BlockStyle` (opcional en todos los bloques y estructuras):**
  - `background`: `{ type: 'none' | 'solid' | 'gradient' | 'image'; color?; gradient?: { kind: 'linear' | 'radial'; angle: number; stops: [string, string, string?] }; imageUrl?; overlayColor?; overlayOpacity?: number }`
  - `border`: `{ width: number; style: 'none' | 'solid' | 'dashed' | 'dotted'; color: string; sides?: 'all' | 'top' | 'bottom' | 'left' | 'right' }`
  - `radius`: `{ mode: 'uniform' | 'custom'; value?; tl?; tr?; br?; bl? }`
  - `padding`: `{ mode: 'uniform' | 'axis' | 'custom'; value?; x?; y?; t?; r?; b?; l? }`
  - `maxWidth?`: `'full' | '1200' | '960' | '760' | '560'` (en estructuras y cajas)
  - `shadow`: `'none' | 'soft' | 'medium' | 'elevated' | 'glow'` + `shadowColor?`
  - `opacity`: `0.1` a `1`
  - `backdropBlur`: `0` a `24` (vidrio esmerilado / glassmorphism)
  - `motion`: `{ entrance?: 'none' | 'fade' | 'slide-up' | 'zoom'; hover?: 'none' | 'lift' | 'glow' | 'scale' }`
- **`PageTheme` (opcional en raíz de `CanvasDoc`):**
  - `presetId?`, `palette` (`primary`, `accent`, `surface`, `surfaceMuted`, `text`, `textMuted`, `border`, `pageBg`), `typography` (`headingFont`, `bodyFont`, `scale`), `radiusScale`, `density`.
- **`RichTextV2` (unión retrocompatible con `RichTextV1`):**
  - `RichTextV1`: `{ format: 'plain', value: string }` (conservado tal cual).
  - `RichTextV2`: `{ format: 'rich', blocks: RichBlock[] }` donde cada bloque (`paragraph` | `bulletList` | `orderedList`) contiene `runs: TextRun[]` (`text`, `bold?`, `italic?`, `underline?`, `strike?`, `color?`, `highlight?`, `href?`, `newTab?`, `sub?`, `sup?`) y `listStyle?` (`disc` | `check` | `arrow` | `circle-number`). Validado por Zod, cero HTML sin sanear.

### 3.2 Archivos nuevos previstos
```text
src/editor2/
  domain/
    styleSchema.ts          # BlockStyle, PageTheme, MediaStyle, temas curados
    richText.ts             # RichTextV1 | RichTextV2, conversión Tiptap JSON <-> RichTextV2
    styleToCss.ts           # BlockStyle + PageTheme -> CSSProperties / variables --e2-page-*
    templates.ts            # Catálogo inicial de plantillas de sección editables (1-clic)
  components/
    DesignInspector.tsx     # Inspector de 2 niveles (Barra rápida + Panel plegable Diseño)
    GradientPicker.tsx      # Selector visual de degradados (tipo, ángulo, paradas, presets)
    ThemeDrawer.tsx         # Cajón Tema global de página (6 presets + edición libre)
    TemplateDrawer.tsx      # Cajón Plantillas de sección y Presets de estilo guardados
    InlineRichText.tsx      # Editor inline Tiptap v3 encapsulado con barra flotante
    IconPickerModal.tsx     # Catálogo ~70 iconos médicos/UI sobre lucide/tabler con búsqueda ES
    Editor2Lightbox.tsx     # Visor ampliado propio (zoom + Escape) para multimedia v2
```

---

## 4. Plan por partes (con pausa de revisión en cada parte)

### Parte 1 — Contrato visual (`BlockStyle`), motor `styleToCss` y bloque `Tarjeta / Caja` (`box`)
- **Alcance:**
  - Crear `styleSchema.ts` y `styleToCss.ts` con validación Zod estricta y retrocompatible con documentos de Fase 1.
  - Añadir `style?: BlockStyle` a todos los bloques de contenido, multimedia y estructura (`Bloque de página`, `Pestañas`, `Acordeón`).
  - Añadir bloque contenedor **`Tarjeta / Caja` (`box`)** en **ESTRUCTURA** (colocable en `Bloque de página`, `Pestañas` y `Acordeón`, con hasta 1 nivel de `box` dentro de `box`, redimensionable en la cuadrícula de 24 columnas, con zona interna libre para agrupar cualquier bloque y `maxWidth` configurable).
  - Conectar `styleToCss` en `Editor2Blocks.tsx` y `Editor2Renderer.tsx` para paridad 1:1 entre editor y `/vista-v2/:pageKey`.
- **Verificación:** pruebas unitarias de esquema Zod (Fase 1 + Fase 2), `styleToCss`, anidamiento acotado de `box`, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** comprobar en navegador que `Tarjeta / Caja` agrupa bloques, se redimensiona y persiste al guardar/recargar.

### Parte 2 — Inspector `Diseño` (Revelación Progresiva), Brocha Copiar/Pegar Estilo y Vista Responsiva
- **Alcance:**
  - Construir `DesignInspector.tsx` en dos niveles:
    - **Nivel 1 (Barra contextual):** fondo rápido, borde rápido, sombra rápida, **alineación vertical (`verticalAlign`)**, **Copiar estilo**, **Pegar estilo** y botón **`Diseño`**.
    - **Nivel 2 (Panel plegable `Diseño`):** acordeones limpios para *Superficie* (sólido, `GradientPicker` visual, imagen de fondo R2/Atlas + overlay), *Borde* (grosor, estilo, color, lado único para acentos/guía lateral), *Esquinas, ancho y relleno*, *Sombra y cristal* (`backdropBlur`, opacidad) y *Restablecer estilo*.
  - Portapapeles de estilo en `editor2Store.ts` con atajos `Ctrl+Alt+C` / `Ctrl+Alt+V`.
  - **Selector de vista responsiva** (`Escritorio` / `Tableta` / `Móvil`) en la barra superior del editor + interruptor *Apilar en móvil* por bloque/contenedor (activado por defecto).
- **Verificación:** pruebas de copia/pegado de estilo, reset, vista responsiva, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** validar en navegador que la UX es rápida, limpia y no abruma al editar.

### Parte 3 — Tema global de página (`PageTheme`), `Pestañas` y `Acordeón` estilizados
- **Alcance:**
  - Añadir `pageTheme?: PageTheme` a `CanvasDoc` con variables CSS acotadas (`--e2-page-*`) en editor y vista pública.
  - Crear `ThemeDrawer.tsx` (botón `Tema` en barra superior) con **6 temas curados en 1 clic** (*Atlas Clínico*, *Editorial Violeta*, *Lámina de Laboratorio*, *Microscopía Oscura*, *Papel Académico*, *Contraste Alto*) + edición libre de paleta, pares tipográficos (incluyendo fuentes locales de Atlas como Fraunces e IBM Plex Mono), radio base y densidad.
  - Conectar muestras del tema a todos los selectores de color del `DesignInspector`.
  - Enriquecer **`Pestañas`** (subtítulo opcional por pestaña y `tabStyle: 'underline' | 'pills' | 'cards'` para igualar `topic_divisions`) y **`Acordeón`** (añadir modo **`Revelar pista / tarjeta`** para igualar `weekly_histology_facts`).
- **Verificación:** pruebas de cambio de tema en vivo, persistencia en borrador/versión/publicación, estilos de pestañas/acordeón, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** probar cambio de tema en 1 clic en editor y en `/vista-v2/:pageKey`.

### Parte 4 — Texto enriquecido por fragmento (`RichTextV2` con Tiptap v3), `Tabla` y `Separador`
- **Alcance:**
  - Crear `richText.ts` (`RichTextV1 | RichTextV2`) e `InlineRichText.tsx` encapsulando Tiptap v3 (ya instalado) sin importar código del editor v1.
  - Al seleccionar texto en `Título`, `Párrafo` o `Nota / Aviso`, mostrar barra flotante contextual: negrita, cursiva, subrayado, tachado, color de texto, resaltado/marcador, enlace clicable (URL, Página Atlas o Evaluación Atlas), subíndice (`H₂O`) y superíndice (`10×`), más `letterSpacing` y trazo suave en `TextAppearance`.
  - Listas con **estilo y color de viñeta** (`disc`, `check`, `arrow`, `circle-number`) dentro de `Párrafo` para recrear `list` y `histology_bullet_cards`.
  - Enriquecer **`Tabla`** (color de cabecera, filas cebra, densidad, bordes) y **`Separador`** (sólido, punteado, degradado, ancho y **etiqueta centrada**).
- **Verificación:** pruebas de conversión `Tiptap JSON <-> RichTextV2`, retrocompatibilidad `RichTextV1`, ausencia de HTML inseguro, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** probar selección de palabras, colores, fórmulas, listas con checkmarks y tablas estilizadas en el lienzo.

### Parte 5 — Componentes atómicos (`Insignia`, `Icono`), `Botón` con Evaluaciones y Multimedia completa
- **Alcance:**
  - Nuevo bloque **`Insignia / Etiqueta` (`badge`)** en CONTENIDO: texto + icono opcional + estilo (`sólida`, `suave`, `contorno`, `cristal`, **`muestra de color / colorimetría`** para `histology_stains`) + color libre o del tema.
  - Nuevo bloque **`Icono` (`icon`)** + `IconPickerModal.tsx` (~70 iconos médicos/histológicos/educativos/UI sobre `lucide-react` y `@tabler/icons-react`, con buscador en español insensible a acentos, tamaño, color y marco opcional).
  - Mejorar **`Botón`**: icono opcional, variantes (`sólido`, `degradado`, `contorno`, `fantasma`, `pastilla`), radio y **selector de Evaluación Atlas** además de Página Atlas y URL libre.
  - Mejorar **`Imagen`, `GIF`, `Carrusel`, `Comparador` y `Video`**: relación de aspecto bloqueable (`auto`, `16:9`, `4:3`, `1:1`, `3:4`), **punto focal (`objectPosition`)**, **etiqueta superpuesta en esquina (`overlayBadge`)**, radio, borde, sombra, filtros visuales (brillo, contraste, saturación, escala de grises), **autoplay/intervalo/flechas/puntos en Carrusel** y **visor ampliado propio (`Editor2Lightbox.tsx`)**.
- **Verificación:** pruebas de los nuevos bloques, visor ampliado, carrusel con autoplay/controles, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** armar en vivo una tarjeta de tinción + galería con visor y comprobar acabado visual.

### Parte 6 — Animaciones sutiles, Hover y Biblioteca de Plantillas/Presets en Supabase
- **Alcance:**
  - Controles opcionales en `DesignInspector` para **animación de entrada** (`ninguna`, `aparecer`, `subir suave`, `zoom sutil`) y **efecto hover** (`ninguno`, `elevar`, `borde brillante`, `escala suave`), ejecutados con `IntersectionObserver` ligero en vista pública y desactivados automáticamente con `prefers-reduced-motion: reduce`.
  - Crear `TemplateDrawer.tsx` (botón `Plantillas` en barra superior) con:
    1. **Catálogo inicial de plantillas editables 1-clic** (construidas 100 % con bloques de Editor 2.0): *Publicación semanal*, *Semana de exámenes*, *Ficha de generalidades*, *Tríada histológica*, *Tabla de tinciones*, *Tarjetas de correlación clínica*, *Dato histológico con pista* y *Galería comparativa*.
    2. **Tus plantillas guardadas** (guardar cualquier sección actual como plantilla reutilizable) y **Presets de estilo** guardables.
  - Migración SQL local aislada `database/editor2/002_presets_templates.sql` (y actualización de `database/editor2/999_drop.sql`) para persistir presets y plantillas en el esquema `editor2` de Supabase (portables entre equipos). *No se ejecuta en remoto sin autorización expresa del usuario.*
- **Verificación:** pruebas de inserción de plantillas, presets, `prefers-reduced-motion`, servicios API v2, `typecheck`, `build` y `design:check`.
- **Pausa de revisión:** insertar en 1 clic varias plantillas equivalentes al v1 y editar libremente cada elemento interno.

### Parte 7 — Cierre de Fase 2, auditoría responsiva y verificación integral
- **Alcance:**
  - Auditoría visual y responsiva del editor y de `/vista-v2/:pageKey` en `360 px`, `768 px` y `1280 px`.
  - Verificación práctica de recreación de familias representativas de las 30 plantillas v1.
  - Chequeo de aislamiento (0 imports del editor v1, 0 referencias a `content_*`, 0 menciones a Cloudinary).
  - Ejecución completa de `npm test`, `npm run typecheck`, `npm run build` y `npm run design:check`.
  - Actualización de este plan y de `docs/guia-atlas.md` cerrando Fase 2.

---

## 5. Qué queda explícitamente fuera de Fase 2

- Sustituir las páginas públicas actuales (`Home.tsx`, `TemarioPublico.tsx`, `Subtemas.tsx`, `PlacasSubtema.tsx`) por el renderizador v2 y el widget dinámico automático `ExamWeekTestsCarousel` (corresponden a **Fase 3**).
- Migrar datos antiguos de las tablas `content_*` del editor v1.
- Modificar o eliminar archivos del editor v1 (`EditorPaginas.tsx`, `PageContentEditor.tsx`, `ContentBlockRenderer.tsx`, `blockRegistry.ts`).
- Ejecutar scripts SQL en remoto o subir cambios a GitHub (`git push`) sin autorización expresa.
