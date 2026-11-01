# Configuración de producción — 30 de octubre de 2026

Revisión de solo lectura del panel del proyecto `atlas-histolab` en Cloudflare Pages, entorno **Production**.

| Requisito del Worker local | Observación en el panel |
| --- | --- |
| `SUPABASE_URL` | Presente, tipo Secret, valor cifrado. |
| `SUPABASE_SERVICE_ROLE_KEY` | Presente, tipo Secret, valor cifrado. |
| `R2_BUCKET` | Binding de tipo R2 bucket vinculado a `atlas-media`. |
| `R2_PUBLIC_DOMAIN` | Presente, tipo Secret, valor cifrado. |
| `VITE_R2_PUBLIC_DOMAIN` | Presente, tipo Secret, valor cifrado. |

La función remota `atlas_authorize_token(text,text[])` fue revisada mediante metadatos: es SQL STABLE y consulta sesiones y usuarios; comprueba revocación, expiración, usuario activo, versión de sesión y roles. `service_role` tiene permiso de ejecución, mientras que `anon` y `authenticated` no lo tienen.

**Conclusión:** los nombres de las variables y el binding necesarios para las nuevas validaciones están declarados en producción. No es necesario crear esos nombres nuevamente. La observación no demuestra que los valores cifrados sean correctos, estén vigentes o que el despliegue activo corresponda al código local. No se revelaron secretos ni se ejecutaron pruebas con sesiones reales o escrituras de imágenes.

El flujo local de GitHub Actions copia `cloudflare/_worker.js` al paquete desplegado. Las correcciones locales de autorización y conservación de archivos siguen pendientes de publicación autorizada; esta revisión no despliega código ni cambia configuración.

Se observaron también variables históricas del proveedor anterior. No se editaron ni eliminaron como parte de esta comprobación.
