export type CloudinaryImageProfile = 'thumbSmall' | 'thumb' | 'cardWideSmall' | 'cardWide' | 'view' | 'zoom';

const R2_PUBLIC_DOMAIN = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_DOMAIN) ||
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev'
).replace(/\/+$/, '');

export const getCloudinaryImageUrl = (
  originalUrl: string,
  _profile?: CloudinaryImageProfile
): string => {
  if (!originalUrl || typeof originalUrl !== 'string') return '';

  const trimmed = originalUrl.trim();

  let path = trimmed;
  if (trimmed.includes('res.cloudinary.com')) {
    path = trimmed.replace(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(v\d+\/)?/, '');
    path = path.replace(/^(?:[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*\/)+/, '');
  } else if (trimmed.startsWith(R2_PUBLIC_DOMAIN)) {
    path = trimmed.slice(R2_PUBLIC_DOMAIN.length);
  } else if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('.r2.dev')) {
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

  return `${R2_PUBLIC_DOMAIN}/${cleanKey}`;
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

  // 2. URL directa original de la BD si es HTTP y diferente
  if (/^https?:\/\//i.test(trimmed) && !list.includes(trimmed)) {
    list.push(trimmed);
  }

  // 3. Fallback con extensión original en R2 si era jpg/png
  if (trimmed.match(/\.(jpe?g|png|bmp|tiff?)$/i)) {
    const extMatch = trimmed.match(/\.(jpe?g|png|bmp|tiff?)$/i);
    if (extMatch && resolved.endsWith('.webp')) {
      const originalExtUrl = resolved.replace(/\.webp$/, extMatch[0]);
      if (!list.includes(originalExtUrl)) {
        list.push(originalExtUrl);
      }
    }
  }

  // 4. Versión anti-caché con timestamp
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
