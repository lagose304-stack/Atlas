# Assets

Esta carpeta contiene todos los recursos estáticos del proyecto.

## Estructura

- **`logos/`** - Logos de la aplicación y instituciones
  - Formatos recomendados: PNG, SVG, JPG
  - Usar nombres descriptivos (ej: logo-unah.png, logo-atlas.svg)

- **`icons/`** - Iconos para la interfaz
  - Formatos recomendados: SVG, PNG
  - Usar nombres descriptivos (ej: edit-icon.svg, user-icon.png)

## Uso en componentes

```tsx
// Importar imagen
import logoAtlas from '../assets/logos/logo-atlas.png';

// Usar en JSX
<img src={logoAtlas} alt="Logo Atlas" />
```

## Formatos soportados

- **PNG** - Para imágenes con transparencia
- **JPG/JPEG** - Para fotografías 
- **SVG** - Para iconos vectoriales (recomendado)
- **WebP** - Para imágenes optimizadas