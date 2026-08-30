export type CloudinaryImageProfile = 'thumbSmall' | 'thumb' | 'cardWideSmall' | 'cardWide' | 'view' | 'zoom';

const R2_PUBLIC_DOMAIN = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_DOMAIN) ||
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev'
).replace(/\/+$/, '');

// ── Registro de versiones / Cache-busting para imágenes reemplazadas ──
const IMAGE_VERSION_CACHE_KEY = 'atlas_image_versions_v1';

const getStoredImageVersions = (): Record<string, number> => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(IMAGE_VERSION_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const memoryImageVersions: Record<string, number> = getStoredImageVersions();

/**
 * Invalida la memoria y caché local del navegador para una placa o imagen específica,
 * forzando a que cualquier componente (miniaturas, visor público, editor) cargue la nueva versión de inmediato.
 */
export const invalidateImageCache = (photoUrlOrStorageKey: string): void => {
  if (!photoUrlOrStorageKey) return;
  const now = Date.now();
  const trimmed = photoUrlOrStorageKey.trim();
  memoryImageVersions[trimmed] = now;

  // Extraer también versión normalizada/limpia para asegurar matching
  const clean = trimmed
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^atlas-media\//i, '')
    .replace(/^\/+/, '');
  if (clean) {
    memoryImageVersions[clean] = now;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = getStoredImageVersions();
      stored[trimmed] = now;
      if (clean) stored[clean] = now;
      window.localStorage.setItem(IMAGE_VERSION_CACHE_KEY, JSON.stringify(stored));
    } catch {
      // Ignorar errores de quota en localStorage
    }
  }

  // Notificar a componentes en otras pestañas o componentes activos
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('atlas:image-invalidated', { detail: { url: trimmed, timestamp: now } }));
  }
};

export const getCloudinaryImageUrl = (
  originalUrl: string,
  profile?: CloudinaryImageProfile
): string => {
  if (!originalUrl || typeof originalUrl !== 'string') return '';

  const trimmed = originalUrl.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Detectar si la URL ya tiene o requiere versión de cache-busting
  const cleanOriginal = trimmed
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^atlas-media\//i, '')
    .replace(/^\/+/, '');
  const version = memoryImageVersions[trimmed] || memoryImageVersions[cleanOriginal] || null;

  let path = trimmed;
  if (trimmed.includes('res.cloudinary.com')) {
    path = trimmed.replace(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(v\d+\/)?/, '');
    path = path.replace(/^(?:[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*\/)+/, '');
  } else if (trimmed.startsWith(R2_PUBLIC_DOMAIN)) {
    path = trimmed.slice(R2_PUBLIC_DOMAIN.length);
  } else if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('.r2.dev')) {
    if (version) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${sep}v=${version}`;
    }
    return trimmed;
  }

  let cleanKey = path
    .replace(/^\/+/, '')
    .replace(/^atlas-media\//i, '')
    .replace(/^atlas\//i, '')
    .replace(/^placas_sin_clasificar\//i, 'placas/sin_clasificar/')
    .replace(/^sin_clasificar\//i, 'placas/sin_clasificar/')
    .replace(/\.(jpe?g|png|bmp|tiff?)$/i, '.webp');

  if (!cleanKey.endsWith('.webp') && !cleanKey.includes('.')) {
    cleanKey += '.webp';
  }

  // Si no tiene prefijo de carpeta conocido, deducir la ruta correcta en Cloudflare R2
  const knownPrefixes = ['placas/', 'temas/', 'subtemas/', 'creditos/', 'pruebas/'];
  const hasKnownPrefix = knownPrefixes.some(prefix => cleanKey.startsWith(prefix));

  if (!hasKnownPrefix) {
    cleanKey = `placas/sin_clasificar/${cleanKey}`;
  }

  const isThumbProfile = profile === 'thumb' || profile === 'thumbSmall';

  if (isThumbProfile) {
    if (!cleanKey.endsWith('_thumb.webp')) {
      cleanKey = cleanKey.replace(/\.webp$/i, '_thumb.webp');
    }
  } else {
    // Para perfiles completos (view, zoom, cardWide), asegurarse de que no use la miniatura
    cleanKey = cleanKey.replace(/_thumb\.webp$/i, '.webp');
  }

  const finalUrl = `${R2_PUBLIC_DOMAIN}/${cleanKey}`;
  if (version) {
    return `${finalUrl}?v=${version}`;
  }

  return finalUrl;
};

export const getImageCandidateUrls = (
  originalUrl: string,
  profile?: CloudinaryImageProfile
): string[] => {
  if (!originalUrl || typeof originalUrl !== 'string') return [];
  const list: string[] = [];
  const trimmed = originalUrl.trim();

  // 1. URL procesada Cloudflare R2 / WebP
  const resolved = getCloudinaryImageUrl(trimmed, profile);
  if (resolved) {
    list.push(resolved);
  }

  // 2. Si es perfil de miniatura, agregar la versión full como fallback inmediato
  if (profile === 'thumb' || profile === 'thumbSmall') {
    const fullResUrl = getCloudinaryImageUrl(trimmed, 'view');
    if (fullResUrl && !list.includes(fullResUrl)) {
      list.push(fullResUrl);
    }
  }

  // 3. URL directa original de la BD si es HTTP y diferente
  if (/^https?:\/\//i.test(trimmed) && !list.includes(trimmed)) {
    list.push(trimmed);
  }

  // 4. Fallback con extensión original en R2 si era jpg/png
  if (trimmed.match(/\.(jpe?g|png|bmp|tiff?)$/i)) {
    const extMatch = trimmed.match(/\.(jpe?g|png|bmp|tiff?)$/i);
    if (extMatch && resolved.endsWith('.webp')) {
      const originalExtUrl = resolved.replace(/\.webp$/, extMatch[0]);
      if (!list.includes(originalExtUrl)) {
        list.push(originalExtUrl);
      }
    }
  }

  // 5. Versión anti-caché con timestamp
  const primary = list[0] || trimmed;
  if (primary && primary.startsWith('http')) {
    const sep = primary.includes('?') ? '&' : '?';
    const timestamped = `${primary}${sep}t=${Date.now()}`;
    if (!list.includes(timestamped)) {
      list.push(timestamped);
    }
  }

  return list;
};
