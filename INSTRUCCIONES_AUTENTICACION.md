# Configuración del Sistema de Autenticación

## Pasos para configurar la base de datos de usuarios en Supabase

### 1. Acceder a tu proyecto de Supabase
1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión y selecciona tu proyecto

### 2. Crear la tabla de usuarios
1. En el panel lateral izquierdo, haz clic en **"SQL Editor"**
2. Haz clic en **"New query"**
3. Copia y pega el contenido del archivo `database/setup_usuarios.sql`
4. Haz clic en **"Run"** para ejecutar el script

### 2.1. Migracion recomendada de seguridad de sesion
Si ya tienes la tabla creada, ejecuta tambien el archivo `database/alter_usuarios_seguridad_sesion.sql`.

Esta migracion agrega:
- `activo`: para desactivar cuentas sin borrarlas
- `session_version`: para revocar sesiones abiertas al editar o desactivar usuarios

### 2.1.1. Flag de usuario protegido (solo base de datos)
Ejecuta tambien `database/alter_usuarios_protected_flag.sql`.

Este campo agrega:
- `is_protected`: bloquea editar/desactivar usuarios desde la app

Reglas:
- Se administra solo en base de datos (no hay control en UI para activarlo/desactivarlo)
- Por defecto se crea en `false` (apagado)

### 2.2. Auditoria de seguridad (recomendado)
Ejecuta el archivo `database/setup_security_audit_logs.sql` para registrar eventos como:
- Login exitoso y fallido
- Bloqueo temporal por intentos repetidos
- Sesiones invalidadas por timeout, desactivacion o revocacion
- Intentos de acceso a rutas sin permiso por rol

### 3. Verificar que la tabla se creó correctamente
1. En el panel lateral, haz clic en **"Table Editor"**
2. Deberías ver la tabla **"usuarios"**
3. Verifica que tenga los usuarios de ejemplo (admin y editor)

### 4. Personalizar los usuarios
Puedes modificar los usuarios predeterminados o agregar nuevos:

```sql
-- Para agregar un nuevo usuario
INSERT INTO usuarios (username, password, nombre) VALUES
  ('tu_usuario', 'tu_contraseña', 'Tu Nombre');

-- Para actualizar un usuario existente
UPDATE usuarios 
SET password = 'nueva_contraseña', nombre = 'Nuevo Nombre'
WHERE username = 'admin';

-- Para eliminar un usuario
DELETE FROM usuarios WHERE username = 'editor';
```

### 5. Usuarios predeterminados
El script crea estos usuarios de ejemplo:

| Usuario | Contraseña | Nombre |
|---------|------------|---------|
| admin | admin123 | Administrador |
| editor | editor123 | Editor Principal |

**⚠️ IMPORTANTE: Cambia estas contraseñas antes de usar en producción**

### 6. Seguridad en producción
**Nota importante:** Este sistema usa contraseñas en texto plano por simplicidad. Para un entorno de producción, deberías:

1. Usar hashing de contraseñas (bcrypt, argon2, etc.)
2. Implementar autenticación JWT o usar Supabase Auth
3. Agregar rate limiting para prevenir ataques de fuerza bruta
4. Implementar registro de intentos de login fallidos

## Cómo funciona el sistema

1. El usuario hace clic en "Ir a Edición" en la página de inicio
2. Se muestra un formulario de login
3. El sistema verifica las credenciales contra la tabla `usuarios` en Supabase
4. Si las credenciales son correctas, el usuario accede a la página de edición
5. Si son incorrectas, se muestra el mensaje "Acceso denegado"
6. El usuario puede cerrar sesión desde la página de edición

Adicionalmente, la app revalida periodicamente la sesion contra la base de datos. Si la cuenta fue desactivada o su `session_version` cambio, la sesion se cierra automaticamente.

Tambien existe un timeout de sesion y bloqueo temporal por intentos fallidos.

## Analitica del sitio (visitas y consultas)

Para habilitar el panel de estadisticas en la seccion de edicion:

1. Ejecuta `database/setup_site_analytics_events.sql` en Supabase.
2. Verifica que existan eventos en `site_analytics_events`.

Eventos registrados por la app:
- `site_visit`: 1 vez por sesion de navegador
- `tema_view`: al abrir una pagina de tema (subtemas)
- `subtema_view`: al abrir una pagina de subtema (placas)
- `placa_view`: al abrir una placa en el visor

El panel de estadisticas es solo para usuarios con rol `Administrador`.

Reinicio de estadisticas:
- Existe un boton para reiniciar estadisticas en el panel de Estadisticas.
- Solo se muestra si el usuario autenticado tiene `is_protected = true`.
- Para que funcione, la tabla `site_analytics_events` debe tener la politica DELETE (incluida en `setup_site_analytics_events.sql`).

## Indicador de usuarios activos (ojo flotante)

Para habilitar el contador de usuarios activos en Inicio, Subtemas y Placas:

1. Ejecuta `database/setup_site_online_presence.sql` en Supabase.

Comportamiento:
- Se muestra un indicador flotante con icono de ojo y total de usuarios activos.
- El valor representa usuarios con actividad reciente en cualquier parte del sitio.
- El cliente envia heartbeat periodico y refresca el contador automaticamente.

## Estructura del código

- `src/contexts/AuthContext.tsx` - Maneja el estado de autenticación
- `src/components/LoginForm.tsx` - Formulario de inicio de sesión
- `src/components/PrivateRoute.tsx` - Protege rutas privadas
- `src/pages/Edicion.tsx` - Página protegida con botón de cerrar sesión
- `src/pages/Home.tsx` - Página de inicio con botón que abre el login

## Solución de problemas

### El login no funciona
1. Verifica que las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configuradas
2. Verifica que la tabla `usuarios` existe en Supabase
3. Verifica que las políticas de seguridad (RLS) permitan leer la tabla
4. Abre la consola del navegador para ver errores

### Error de CORS
1. Verifica que tu dominio esté permitido en la configuración de Supabase
2. En Supabase Dashboard, ve a Settings > API > URL Configuration
