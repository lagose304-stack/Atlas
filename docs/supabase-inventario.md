# Inventario verificado de Supabase

## Alcance de la observación

Revisión del 30 de octubre de 2026 mediante el complemento de Supabase. El proyecto se identificó cotejando su referencia con `VITE_SUPABASE_URL` del entorno local; coincidieron. Se consultaron tablas de `public`, historial de migraciones y metadatos de restricciones, políticas y firmas de funciones de los catálogos PostgreSQL.

Solo se realizaron lecturas. No se invocaron funciones de la aplicación ni se consultaron filas de usuarios, sesiones, preguntas o contenido. No se modificaron datos, esquemas, políticas ni configuración. Se omiten credenciales y datos personales.

Es una fotografía del esquema, no una auditoría de seguridad ni una comprobación de todos los flujos. Revalidar los objetos implicados cuando una tarea dependa de su estado actual.

## Tablas confirmadas

El listado devolvió 28 tablas de `public`, todas con RLS activado. Esto no demuestra que sus políticas, permisos o funciones privilegiadas sean correctos; no se evaluó funcionalmente la autorización.

| Área | Tablas presentes |
| --- | --- |
| Catálogo | `temas`, `subtemas`, `placas`, `placas_sin_clasificar`, `tinciones`, `interactive_maps` |
| Contenido | `content_blocks`, `content_block_versions`, `content_page_publications`, `content_page_versions` |
| Evaluaciones | `pruebas`, `prueba_preguntas`, `prueba_pregunta_opciones` |
| Acceso | `usuarios`, `atlas_sessions` |
| Auditoría | `security_audit_logs`, `placas_activity_logs`, `unified_audit_logs` |
| Operación | `site_analytics_events`, `site_online_presence`, `site_runtime_settings`, `site_control_audit_logs`, `site_client_errors` |
| Créditos | `credit_profiles`, `credit_contributors` |
| Otros objetos por investigar según la tarea | `images`, `tests`, `test_question_blocks` |

La existencia de `tests` y `test_question_blocks` junto a `pruebas` no demuestra que sean redundantes o estén abandonadas. No eliminarlas ni migrarlas sin comprobar consumidores y finalidad.

## Relaciones confirmadas y efecto de borrar

La flecha indica «dependiente → referencia». El efecto ocurre al borrar el registro referenciado.

| Dependiente → referencia | Efecto confirmado |
| --- | --- |
| `subtemas.tema_id` → `temas.id` | `CASCADE`: elimina subtemas dependientes. |
| `placas.tema_id` → `temas.id` | `CASCADE`: elimina placas dependientes. |
| `placas.subtema_id` → `subtemas.id` | `CASCADE`: elimina placas dependientes. |
| `interactive_maps.tema_id` → `temas.id` | `CASCADE`: elimina mapas dependientes. |
| `interactive_maps.placa_id` → `placas.id` | `CASCADE`: elimina mapas dependientes. |
| `interactive_maps.subtema_id` → `subtemas.id` | `SET NULL`; otras cascadas también pueden afectar al mapa. |
| `prueba_preguntas.prueba_id` → `pruebas.id` | `CASCADE`: elimina preguntas dependientes. |
| `prueba_pregunta_opciones.pregunta_id` → `prueba_preguntas.id` | `CASCADE`: elimina opciones dependientes. |
| `prueba_preguntas.reference_placa_id` → `placas.id` | `SET NULL`: conserva la pregunta y vacía la referencia. |
| `pruebas.tema_id` / `subtema_id` → catálogo | `SET NULL`: conserva la evaluación. |
| `atlas_sessions.user_id` → `usuarios.id` | `CASCADE`: elimina sesiones dependientes. |
| `pruebas.created_by_id` / `updated_by_id` → `usuarios.id` | `SET NULL`. |
| `pruebas.created_by` → `auth.users.id` | `SET NULL`; convive con el modelo propio de usuarios. |
| `site_control_audit_logs.user_id`, `site_runtime_settings.updated_by`, `unified_audit_logs.actor_user_id` → `usuarios.id` | `SET NULL`. |
| `tests.tema_id` → `temas.id` | `CASCADE`. |
| `tests.subtema_id` → `subtemas.id` | `SET NULL`. |
| `test_question_blocks.test_id` → `tests.id` | `CASCADE`. |

No existe una transacción implícita con R2. Borrar una fila no demuestra que se haya borrado un archivo, ni borrar un archivo actualiza sus referencias por sí mismo.

## Funciones principales confirmadas

Se verificó existencia y firma, sin ejecutarlas ni auditar sus cuerpos. Se muestran tipos de parámetros; antes de invocar, comprobar nombres y efectos actuales.

| Función | Tipos de parámetros confirmados |
| --- | --- |
| `atlas_login` | `text, text` |
| `atlas_validate_session`, `atlas_logout` | Sin parámetros. |
| `atlas_authorize_token` | `text, text[]` |
| `atlas_get_public_test` | `uuid` |
| `atlas_grade_test` | `uuid, jsonb` |
| `guardar_prueba_completa` | Dos firmas: `uuid, text, text, jsonb` y `uuid, text, text, jsonb, integer, text`. |
| `save_content_page_version` | `text, integer, text, text` |
| `restore_content_page_version` | `bigint, boolean` |
| `publish_page_version` | Dos firmas: `bigint, text, text` y `bigint, uuid, text`. |
| `atlas_get_total_site_views` | Sin parámetros. |
| `atlas_list_active_sessions`, `atlas_clean_stale_presence` | Sin parámetros. |
| `atlas_revoke_session` | `uuid` |
| `atlas_set_site_maintenance` | `boolean, text` |
| `atlas_update_site_controls` | `jsonb` |

También hay auxiliares de roles, token, usuario de sesión, contexto de base de datos y triggers. Varias funciones están marcadas `SECURITY DEFINER`; revisar autorización y privilegios al modificarlas, sin deducir un fallo solo por esta característica.

Las firmas múltiples importan para el frontend: no asumir que el autor es siempre UUID, pues `publish_page_version` admite una variante `text`. No eliminar firmas ni cambiar parámetros como limpieza incidental; comprobar consumidores y resolución cuando la tarea lo requiera.

## Migraciones y límites pendientes

El complemento devolvió una lista vacía de migraciones registradas. Esto **no significa** que falten cambios ni autoriza ejecutar `database/`: las tablas y funciones anteriores sí existen. El origen y la secuencia de cambios no quedan determinados por esa respuesta.

Quedan fuera de esta revisión:

- Detalle de columnas, índices, triggers, expresiones de políticas y privilegios efectivos.
- Cuerpos de funciones, resolución de cada llamada y pruebas por rol.
- Configuración de Data API y esquemas expuestos.
- Respaldos, recuperación, inventario de R2 y referencias huérfanas.
- Entornos de pruebas, bindings, secretos de Cloudflare y commit desplegado.

Consultar solo lo que requiera la tarea. Para cambios de datos o esquema, seguir el procedimiento de [la guía de Atlas](guia-atlas.md) y [AGENTS.md](../AGENTS.md).
