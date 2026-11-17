# Contrato portable de diseño web

Este documento hace que cualquier IA, en cualquier editor, use las mismas herramientas y el mismo criterio para mejorar la interfaz de Atlas. La fuente ejecutable es [la regla de calidad visual](../.agents/rules/design-quality.md); [la skill `diseno-web`](../.agents/skills/diseno-web/SKILL.md) Describe el procedimiento. No se ha copiado contenido de terceros al repositorio.

## Cuándo aplica

Aplica a cualquier cambio en `src/**/*.{tsx,jsx,css,scss,html}` que afecte páginas, componentes, estilos, animaciones, estados, responsive, accesibilidad visual o textos visibles. No cambia las reglas de Supabase, R2, sesiones ni publicación.

## Fuentes fijadas

Las versiones se registraron el 17 de noviembre de 2026. Están verificadas en los repositorios oficiales; sus licencias se conservan aguas arriba.

| Herramienta | Repositorio y commit | Licencia | Instalación | Aporte |
| --- | --- | --- | --- | --- |
| Emil Kowalski | [`emilkowalski/skills`](https://github.com/emilkowalski/skills) @ `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c` | MIT | `npx skills@latest add emilkowalski/skills` | Acabado de detalles y movimiento: curvas, duración, propiedades, coreografía, detección de animaciones innecesarias y datos extremos. |
| Impeccable | [`pbakaus/impeccable`](https://github.com/pbakaus/impeccable) @ `d41d9860b0094dcb68030657da63461212835aaa` | Apache-2.0 | `npx impeccable install` | Vocabulario de diseño, anti-slop, `polish`/`critique`/`audit`, detector de 62 reglas y revisiones de accesibilidad y responsive. |
| Taste | [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) @ `f6b76575f949707b4e3c37cd86cb44b0b98643e8` | MIT | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | Dirección de arte, composición, sistema visual único y comprobación real en navegador mediante `consistency.mjs` y `gate.mjs`. |

El instalador de Impeccable detecta los editores disponibles y ofrece instalar su hook de diseño; acepta el hook cuando el editor lo permita. Para una instalación no interactiva documentada por el proyecto, usa `npx impeccable install --providers=claude,codex,cursor --scope=project` y ajusta los proveedores a tu editor. Taste necesita Node 22+ y Chrome, Edge o Chromium; en este repositorio se comprobó Node 25.6.0. Reinicia el editor después de instalar skills.

## Adaptadores por editor

Estos archivos apuntan al mismo contrato; edita el contrato, no copies instrucciones divergentes en cada adaptador.

| Editor o agente | Archivo leído automáticamente |
| --- | --- |
| OpenCode, Codex CLI y otros lectores de `AGENTS.md` | [`AGENTS.md`](../AGENTS.md) |
| Claude Code | [`CLAUDE.md`](../CLAUDE.md) |
| Cursor | [`.cursor/rules/diseno-web.mdc`](../.cursor/rules/diseno-web.mdc) |
| GitHub Copilot | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) |
| Gemini CLI | [`GEMINI.md`](../GEMINI.md) |
| Windsurf | [`.windsurfrules`](../.windsurfrules) |

Si tu editor no tiene adaptador, abre este documento y usa este prompt:

```text
Antes de tocar este componente, lee AGENTS.md, .agents/rules/design-quality.md,
.agents/skills/diseno-web/SKILL.md y docs/diseno-web.md. Carga las skills
emilkowalski/skills, pbakaus/impeccable y Leonxlnx/taste-skill. Aplica su
criterio al cambio, ejecuta npm run design:check con el diff visible y reporta
qué usaste, qué pasó y qué no pudiste verificar. No hagas push ni publiques.
```

## Flujo de trabajo

1. **Leer y encuadrar.** Sigue `atlas-desarrollo` para localizar la página, los datos y los consumidores. Define el objetivo visual y las restricciones reales.
2. **Dirigir.** Decide idea rectora, jerarquía, tipografía, color, espacio y movimiento. Usa assets reales de R2 o del repositorio; no plantillas genéricas.
3. **Construir.** Implementa el cambio mínimo reutilizando variables y patrones del ámbito. Conserva formatos guardados, URLs y accesos existentes.
4. **Perfeccionar con las tres skills.**
   - Emil: `ask-emil` para elegir, `emil-design-eng` para el conjunto, `review-animations`/`improve-animations` para revisar y `break-ui` para datos extremos.
   - Impeccable: `polish` antes de cerrar, `critique` para priorizar, `audit` para accesibilidad, rendimiento y responsive; `npx impeccable detect src/` o `npx impeccable detect http://localhost:5173` para hallazgos deterministas.
   - Taste: clasifica el sitio, reparte pantallas y ejecuta `node scripts/consistency.mjs <url> --page <kind>` y `node scripts/gate.mjs` desde la carpeta de la skill cuando esté instalada.
5. **Verificar.** Ejecuta `npm run design:check`. Añade pruebas, `npm run typecheck`, `npm run build` y un recorrido en navegador a 390, 768 y 1440 px según el cambio.
6. **Informar.** Enumera skills usadas, comandos ejecutados, hallazgos corregidos y límites de verificación.

## Verificación automática

| Comando | Comportamiento |
| --- | --- |
| `npm run design:check` | Comprueba que exista el contrato, auditía las líneas nuevas de archivos de diseño y ejecuta el detector de Impeccable si está instalado. Termina con error ante `FAIL`; advierte si no puede ejecutar el detector. |
| `npm run design:check:strict` | Igual que el anterior, pero exige que el detector de Impeccable esté disponible. |

El script revisa imports externos de CSS/fuentes, referencias nuevas a Cloudinary, animaciones infinitas sin `prefers-reduced-motion`, resoluciones de fuente muy pequeñas, `backdrop-filter`, `!important`, colores literales en CSS, imágenes sin `alt`, enlaces nuevos sin `rel` y patrones genéricos de degradado. Es una red de seguridad, no una prueba de buen gusto: no sustituye el navegador, la revisión humana ni los chequeos de Taste sobre una URL.

## Guardarraíles de Atlas

- Mantén la paleta, tipografías y densidad del ámbito existente. Las secciones históricas tienen sistemas propios; no los unifiques sin tarea.
- Usa R2 como único almacenamiento multimedia. Los nombres heredados de `cloudinary*` siguen operando sobre R2.
- No configures otro proveedor, no añadas CSS remoto ni fuentes por CDN, y no reveles secretos.
- Respeta `prefers-reduced-motion`, foco visible, contraste, teclado, pantallas pequeñas y estados de error/vacío.
- No publiques ni hagas push sin petición expresa.

## Mantenimiento

Para actualizar una versión, revisa el README y la licencia de la fuente, ejecuta el comando de instalación correspondiente, anota el nuevo commit y la fecha en la tabla, y ejecuta la verificación completa. No actualices automáticamente las skills ni mezcles sus plantillas con los estilos de Atlas sin revisar el diff.
