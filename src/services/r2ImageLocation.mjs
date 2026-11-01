// Resolución compartida por el frontend y las auditorías de Node, sin red ni entorno.
export function resolveImageLocation(input, publicDomain) {
  const raw = typeof input === 'string' ? input.trim() : '';
  const value = raw.startsWith('//') ? `https:${raw}` : raw;
  const passthrough = { storage: false, legacy: false, key: null, url: value };
  if (!value || /^(blob:|data:|\/)/i.test(value)) return passthrough;
  let key = value;
  let search = '';
  let hash = '';
  let legacy = false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return { ...passthrough, url: '' };
  if (/^https?:\/\//i.test(value)) {
    let parsed;
    try { parsed = new URL(value); }
    catch { return { ...passthrough, url: '' }; }
    const base = new URL(publicDomain);
    legacy = parsed.hostname === 'res.cloudinary.com';
    const isR2 = parsed.origin === base.origin || parsed.hostname.endsWith('.r2.dev');
    if (!legacy && !isR2) return passthrough;
    key = parsed.pathname.replace(/^\/+/, '');
    search = parsed.search;
    hash = parsed.hash;
    if (legacy) {
      key = key.replace(/^[^/]+\/image\/upload\//, '');
      // Las transformaciones y la versión pueden aparecer en cualquiera de estos órdenes.
      let previous;
      do {
        previous = key;
        key = key.replace(/^v\d+\//, '').replace(/^(?:[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*\/)/, '');
      } while (key !== previous);
      key = key.replace(/\.(jpe?g|png|bmp|tiff?)$/i, '.webp');
    }
  } else {
    const parsed = new URL(value, 'https://storage-key.invalid/');
    key = parsed.pathname.replace(/^\/+/, '');
    search = parsed.search;
    hash = parsed.hash;
  }
  key = key.replace(/^atlas-media\//i, '').replace(/^atlas\//i, '')
    .replace(/^placas_sin_clasificar\//i, 'placas/sin_clasificar/')
    .replace(/^sin_clasificar\//i, 'placas/sin_clasificar/')
    .replace(/^placas\/sin_clasificar\/(atlas-content|general)\//i, '$1/');
  if (!/\.[^/]+$/.test(key)) key += '.webp';
  if (!key.includes('/')) key = `placas/sin_clasificar/${key}`;
  return { storage: true, legacy, key, url: `${publicDomain.replace(/\/+$/, '')}/${key}${search}${hash}` };
}
