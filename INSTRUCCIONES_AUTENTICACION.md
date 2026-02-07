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
