# Reglas de Almacenamiento y Multimedia

## Almacenamiento Exclusivo en Cloudflare R2
- **Cloudflare R2** es el único servicio activo para imágenes y multimedia en Atlas (dominio `https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev`).
- **Cloudinary está DEPRECADO**: Ya no se usa Cloudinary. Nunca asumir, configurar o mencionar Cloudinary en la interfaz, código nuevo ni explicaciones.
- **Nombres heredados de funciones/archivos**: Funciones como `uploadToCloudinary`, `getCloudinaryImageUrl`, `deleteFromCloudinary` y los archivos `src/services/cloudinary.ts` / `src/services/cloudinaryImages.ts` mantienen ese nombre por motivos históricos y compatibilidad interna, pero **operan exclusivamente sobre Cloudflare R2**.
- Todas las imágenes subidas son convertidas a WebP y almacenadas en Cloudflare R2.
