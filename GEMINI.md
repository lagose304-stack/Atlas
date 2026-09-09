# Reglas del Proyecto (Atlas)

## Control de Versiones y Git (Obligatorio)
- **NUNCA** ejecutar `git push`, subir cambios a GitHub ni crear commits remotos a menos que el usuario lo solicite **explícita y textualmente por escrito** (por ejemplo, diciendo *"sube los cambios a github"*, *"haz git push"*, etc.).
- Todas las modificaciones deben permanecer en local para revisión y pruebas hasta recibir la orden directa del usuario.

## Almacenamiento de Imágenes (Cloudflare R2 Obligatorio)
- **Cloudflare R2** es el **único** servicio de almacenamiento de imágenes y multimedia de la plataforma Atlas (dominio público: `https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev`).
- **Cloudinary está 100% DEPRECADO**: Nunca asumir, sugerir ni configurar Cloudinary, ni mostrar "Cloudinary" en la interfaz de usuario, mensajes o documentación.
- **Nombres heredados de funciones/archivos**: Funciones y archivos como `src/services/cloudinary.ts`, `src/services/cloudinaryImages.ts`, `uploadToCloudinary` o `getCloudinaryImageUrl` conservan ese prefijo exclusivamente por compatibilidad interna histórica, pero **operan internamente sobre Cloudflare R2**. Todas las imágenes se suben, optimizan a WebP y se sirven desde Cloudflare R2.

