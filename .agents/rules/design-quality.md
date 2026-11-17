# Regla de calidad visual para interfaces web

## Alcance

Aplica a cualquier cambio que afecte la interfaz web de Atlas: páginas, componentes, estilos, animaciones, estados, responsive, accesibilidad visual o copia visible. Incluye `src/**/*.{tsx,jsx,css,scss,html}`. No modifica las reglas de Supabase, R2, sesiones, permisos ni persistencia.

## Obligación para cualquier agente, modelo o editor

Antes de proponer o escribir un cambio visual, y otra vez antes de cerrarlo:

1. Lee [AGENTS.md](../../AGENTS.md), [atlas-desarrollo](../skills/atlas-desarrollo/SKILL.md), esta regla, [la skill de diseño web](../skills/diseno-web/SKILL.md) y [la guía de diseño web](../../docs/diseno-web.md).
2. Usa las tres herramientas externas como parte del trabajo, no como lista de lectura:

   | Herramienta | Uso exigido en Atlas |
   | --- | --- |
   | Emil Kowalski (`emilkowalski/skills`) | Detalles de acabado y movimiento: `emil-design-eng`, `review-animations`, `improve-animations` o `ask-emil` según el caso. |
   | Impeccable (`pbakaus/impeccable`) | Vocabulario y revisión: `polish`, `critique`, `audit` y el detector `npx impeccable detect`. |
   | Taste (`Leonxlnx/taste-skill`) | Dirección de arte y comprobación en navegador: `design-taste-frontend`, sus chequeos de consistencia y la puerta de cierre. |

3. Si una skill no está instalada en el editor, instálala con los comandos de `docs/diseno-web.md` o declara explícitamente la limitación y aplica el checklist local de la skill. No afirmes que usaste una herramienta que no se cargó.
4. Conserva la identidad de Atlas: jerarquía histológica, tipografías y assets locales, imágenes desde R2, movimiento sobrio con `prefers-reduced-motion`, estados de carga/vacío/error y textos en español. No introduzcas proveedores multimedia, CSS externo ni dependencias nuevas sin una tarea que lo pida.
5. Ejecuta `npm run design:check` con el diff visible. Corrige los `FAIL`, justifica los `WARN` que queden y completa las comprobaciones propias del alcance: pruebas, `npm run typecheck`, `npm run build` y recorrido en navegador a 390, 768 y 1440 px cuando el cambio sea visual.
6. Reporta qué skills se usaron realmente, qué comandos se ejecutaron y qué no se pudo verificar.

## Precedencia

Esta regla complementa `atlas-desarrollo`. Si existe conflicto, prevalecen `AGENTS.md`, las necesidades funcionales y la protección de producción. Las recomendaciones de las skills externas no autorizan escrituras remotas, publicación, cambios de persistencia ni renombrados incidentales.

## Verificación

`npm run design:check` revisa el contrato local y los archivos de diseño cambiados. `npm run design:check:strict` exige además que el detector de Impeccable esté instalado. Ninguno sustituye la revisión visual en navegador; solo impide cerrar con fallos detectables y deja constancia de las limitaciones.
