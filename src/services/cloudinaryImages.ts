import { resolveImageLocation } from './r2ImageLocation.mjs';

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
  const trimmed = photoUrlOrStorageKey.trim().split('?')[0];
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
  const location = resolveImageLocation(originalUrl, R2_PUBLIC_DOMAIN);
  if (!location.storage || !location.key) return location.url;

  let key = location.key;
  // Los GIF conservan el original animado en todos los tamaños de componente.
  if (!/\.gif$/i.test(key)) {
    if (profile === 'thumb' || profile === 'thumbSmall') {
      if (!key.endsWith('_thumb.webp')) key = key.replace(/\.[^/.]+$/, '') + '_thumb.webp';
    } else {
      key = key.replace(/_thumb\.webp$/i, '.webp');
    }
  }
  const resolved = new URL(location.url);
  const result = new URL(`${R2_PUBLIC_DOMAIN}/${key}`);
  result.search = resolved.search;
  result.hash = resolved.hash;
  const trimmed = originalUrl.trim();
  const withoutQuery = trimmed.split(/[?#]/)[0];
  const cleanOriginal = withoutQuery.replace(/^https?:\/\/[^/]+\//, '').replace(/^atlas-media\//i, '').replace(/^\/+/, '');
  const version = memoryImageVersions[withoutQuery] || memoryImageVersions[cleanOriginal] || memoryImageVersions[trimmed];
  if (version) result.searchParams.set('v', String(version));
  return result.href;
};

export const getImageCandidateUrls = (
  originalUrl: string,
  profile?: CloudinaryImageProfile
): string[] => {
  const location = resolveImageLocation(originalUrl, R2_PUBLIC_DOMAIN);
  if (!location.url) return [];
  const candidates = new Set<string>([getCloudinaryImageUrl(originalUrl, profile)]);
  if (!location.storage) return [...candidates];

  const full = getCloudinaryImageUrl(originalUrl, 'view');
  if (profile === 'thumb' || profile === 'thumbSmall') candidates.add(full);

  // Las alternativas se mantienen en R2, con los parámetros originales intactos.
  const originalExtension = originalUrl.split(/[?#]/)[0].match(/\.(jpe?g|png|bmp|tiff?)$/i)?.[0];
  const fallback = new URL(full);
  if (location.legacy && originalExtension) {
    fallback.pathname = fallback.pathname.replace(/\.webp$/i, originalExtension);
    candidates.add(fallback.href);
  } else if (originalExtension) {
    fallback.pathname = fallback.pathname.replace(/\.[^/.]+$/, '.webp');
    candidates.add(fallback.href);
  }
  return [...candidates].filter(Boolean);
};
