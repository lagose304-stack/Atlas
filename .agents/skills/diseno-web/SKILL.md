---
name: diseno-web
description: Aplicar las skills de Emil Kowalski, Impeccable y Taste al diseño web de Atlas. Usar antes de crear o modificar páginas, componentes, estilos, animaciones o estados visuales; exige verificación con npm run design:check.
---

# Diseño web de Atlas

## Orientación

Trabaja desde la raíz del repositorio que contiene esta habilidad. Lee [AGENTS.md](../../../AGENTS.md), [atlas-desarrollo](../atlas-desarrollo/SKILL.md), la [regla de calidad visual](../../rules/design-quality.md) y la [guía portable de diseño](../../../docs/diseno-web.md). Esta skill no sustituye el análisis del recorrido funcional: primero entiende qué pantalla cambia y qué datos consume.

No copies repositorios externos al proyecto. Las tres fuentes se instalan en la máquina o el editor y se registran aquí con su commit y licencia.

## Herramientas obligatorias

| Fuente | Commit verificado | Licencia | Instalación | Para qué se usa |
| --- | --- | --- | --- | --- |
| `emilkowalski/skills` | `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c` | MIT | `npx skills@latest add emilkowalski/skills` | `emil-design-eng`, `review-animations`, `improve-animations`, `ask-emil`, `animate` y `break-ui`. Detalle, curvas, duración, propiedades animadas y casos límite. |
| `pbakaus/impeccable` | `d41d9860b0094dcb68030657da63461212835aaa` | Apache-2.0 | `npx impeccable install` | `polish`, `bolder`, `critique`, `audit`, `adapt`, `clarify` y `npx impeccable detect src/`. Vocabulario, anti-slop y revisión técnica. |
| `Leonxlnx/taste-skill` | `f6b76575f949707b4e3c37cd86cb44b0b98643e8` | MIT | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | `design-taste-frontend`, `scripts/consistency.mjs` y `scripts/gate.mjs`. Dirección de arte, composición y comprobación real en navegador. |

Taste requiere Node 22+ y Chrome, Edge o Chromium; Impeccable necesita Node para `npx` y su detector puede escanear archivos o un dev server. Si el editor no carga una skill tras instalarla, reinícialo o usa el comando equivalente del editor; nunca finjas que estaba disponible.

## Elegir el recorrido

| Cambio | Recorrido mínimo |
| --- | --- |
| Componente o sección existente | Impeccable `critique` y `audit` sobre el afectado; Emil `review-animations` si hay movimiento; Taste sobre la página servida. |
| Página nueva o rediseño amplio | Taste clasifica el encargo y reparte pantallas; Impeccable `bolder`/`polish`; Emil `animate` y `break-ui` para el detalle final. |
| Microinteracción o animación | Emil `animate`, `review-animations` e `improve-animations`; verifica `prefers-reduced-motion` y rendimiento. |
| Copia, accesibilidad o responsive | Impeccable `clarify`, `adapt` y `harden`; Taste con chequeos en 390, 768 y 1440 px. |

Atlas suele comportarse como un sitio editorial de servicio/producto. No tomes los shaders, escenas de scroll ni assets genéricos de Taste salvo que el encargo sea explícitamente técnico o de juego; usa la dirección de arte y los chequeos, no su plantilla de inicio.

## Procedimiento

1. **Encuadre.** Identifica página, propósito, audiencia, contenido real disponible y restricciones de datos. Las imágenes salen de R2 o de assets locales del repositorio.
2. **Dirección de arte.** Decide una idea rectora, jerarquía, escala tipográfica, ritmo, color y temperatura de movimiento antes de escribir. Reutiliza variables y patrones del ámbito existente; no globalices tokens de una sección.
3. **Construcción.** Implementa el cambio mínimo en el stack de Atlas. Evita degradados morado-azul, tarjetas dentro de tarjetas, iconos genéricos sobre cada título, texto gris sobre color, Inter por defecto y animaciones infinitas decorativas.
4. **Crítica.** Pasa Impeccable y Emil sobre el diff; aplica Taste a la página servida. Corrige los hallazgos en orden de severidad, no solo el primero.
5. **Cierre.** Ejecuta `npm run design:check`; si el detector de Impeccable está instalado, el script lo invoca. Usa `npm run design:check:strict` cuando quieras exigirlo. Completa pruebas relacionadas, tipos, compilación y navegador según el alcance.
6. **Informe.** Di qué skills se cargaron, qué comandos se ejecutaron, qué cambió, qué comprobaciones pasaron y qué quedó sin verificar.

## Checklist si una skill no está disponible

- Una sola idea visual dominante y alineación consistente; bordes y bordillos iguales a los componentes vecinos.
- Movimiento con `transform`/`opacity`, entradas en `ease-out`, salidas en `ease-in`, duraciones cortas y regla `prefers-reduced-motion`.
- Foco visible, contraste suficiente, objetivos táctiles amplios y estados de carga, vacío y error.
- Imágenes reales de Atlas desde R2 o assets locales; sin proveedores nuevos ni enlaces externos de fuentes/CSS.
- Textos en español y terminología histológica existente; sin datos inventados en etiquetas ilustrativas.
- Resultado legible a 390, 768 y 1440 px con contenido largo y fallos de imagen.

## Cerrar el trabajo

No hagas push ni publiques sin petición expresa. Actualiza `docs/guia-atlas.md` si el cambio altera arquitectura o comportamiento, y `docs/diseno-web.md` solo cuando cambien fuentes, comandos o el contrato. Conserva compatibilidad con bloques, anotaciones y estilos ya guardados.
