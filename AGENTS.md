# Repository Guidelines

## Contexto y guía
Atlas es un sitio de histología en producción. Usa [atlas-desarrollo](.agents/skills/atlas-desarrollo/SKILL.md) para investigar y modificar este repositorio; consulta [la guía](docs/guia-atlas.md). Comunícate en español. Conserva datos y comportamiento fuera del cambio solicitado.

## Protección de producción
- Para investigar Supabase, usa consultas de lectura acotadas. Una función RPC puede escribir aunque parezca una consulta: revisa su definición antes de ejecutarla.
- Tener un complemento conectado no autoriza cambios remotos. Antes de modificar producción, prepara el cambio local, identifica registros y dependencias afectados, explica riesgos y recuperación, verifica un respaldo adecuado y obtén autorización explícita para esa operación.
- No ejecutes automáticamente scripts de `database/`, reinicios, borrados, migraciones ni limpiezas. Localhost puede usar Supabase y R2 de producción.
- No reveles secretos ni los incluyas en código, documentación o salidas. Las credenciales de servidor nunca llevan prefijo `VITE_`.

## Arquitectura y compatibilidad
React/TypeScript consulta Supabase mediante `src/services/supabase.ts`; Atlas usa sesiones propias, RPC y `X-Atlas-Session`. Revisa `AuthContext`, `PrivateRoute`, `security/permissions.ts` y SQL relacionado conjuntamente; no sustituyas este modelo por otro sin una tarea específica.

R2 es el único almacenamiento multimedia activo. Los nombres históricos de los servicios de imágenes se conservan por compatibilidad. No configures otro proveedor ni renombres esas APIs incidentalmente. Revisa frontend, middleware de `vite.config.ts`, `backend/server.js` y `cloudflare/_worker.js` según el entorno. El workflow copia este Worker al despliegue; modificar solo `functions/` puede no resolver producción.

Conserva la separación entre borradores, versiones y publicación, y la compatibilidad de bloques y anotaciones ya guardados.

## Desarrollo y comprobación
- `npm run dev`: frontend y middleware local; `npm run dev:backend`: backend opcional. `dev:all` solo arranca el backend.
- `npm test`: Vitest, jsdom y Testing Library. Prueba individual: `npm test -- src/contexts/AuthContext.test.tsx`.
- `npm run typecheck` y `npm run build`: comprobaciones del frontend. TypeScript usa modo estricto; el chequeo no cubre todo el código de servidor.
- Ajusta las pruebas al cambio; usa datos aislados para flujos con escritura. En documentación, verifica rutas, comandos y diff.
- Sigue el estilo del archivo; no hay un script de lint o formato declarado en el paquete principal.

## Git y mantenimiento
Respeta `.agents/rules/`. Mantén cambios locales; no hagas push, ejecutes `publish:github` ni publiques sin petición expresa. Un push a `main` activa el despliegue. El historial usa `feat:`, `fix:`, `style:` y `refactor:`. No reviertas cambios ajenos. Actualiza la guía al cambiar arquitectura; distingue repositorio y producción comprobada.
