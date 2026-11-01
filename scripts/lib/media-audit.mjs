import { resolveImageLocation } from '../../src/services/r2ImageLocation.mjs';

// Columnas multimedia verificadas en los consumidores del repositorio. Un error
// de tabla, permisos o columna invalida la cobertura; nunca equivale a tabla vacía.
export const MEDIA_SOURCES = [
  ['placas', 'id', 'photo_url'], ['placas_sin_clasificar', 'id', 'photo_url'],
  ['temas', 'id', 'logo_url'], ['subtemas', 'id', 'logo_url'],
  ['pruebas', 'id', 'image_url'], ['prueba_preguntas', 'id', 'reference_photo_url'],
  ['credit_profiles', 'profile_key', 'photo_url'], ['credit_contributors', 'id', 'photo_url'],
  ['content_blocks', 'id', 'content'], ['content_page_versions', 'id', 'blocks'],
  ['content_page_publications', 'id', 'published_blocks'], ['content_block_versions', 'id', 'blocks'],
  // Los mapas usan la imagen de su placa; no tienen una columna image_url propia.
  ['interactive_maps', 'id', 'placa_id'],
].map(([table, id, column]) => ({ table, id, column }));

export function extractReferences(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, i) => extractReferences(item, [...path, String(i)]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => extractReferences(item, [...path, key]));
  if (typeof value !== 'string' || !value.trim()) return [];
  const urls = value.match(/https?:\/\/[^\s"'<>\\]+/gi) || [];
  if (!urls.length && /^(?:atlas-media\/|atlas\/)?(?:placas\/|placas_sin_clasificar\/|temas\/|subtemas\/|creditos\/|pruebas\/|atlas-content\/|general\/|test_references\/)/.test(value.trim())) urls.push(value.trim());
  return [...new Set(urls)].map(url => ({ url: url.replace(/&amp;/g, '&').split('&quot;')[0], path }));
}

export async function collectReferences(client, sources = MEDIA_SOURCES, pageSize = 250) {
  const references = [], coverage = [];
  for (const source of sources) {
    let offset = 0, expected = null;
    try {
      do {
        const result = await client.from(source.table).select(`${source.id}, ${source.column}`, { count: 'exact' })
          .order(source.id, { ascending: true }).range(offset, offset + pageSize - 1);
        if (result.error) throw Object.assign(new Error('Consulta incompleta'), { code: result.error.code });
        if (!Array.isArray(result.data) || !Number.isInteger(result.count)) throw new Error('Conteo no disponible');
        if (expected !== null && result.count !== expected) throw new Error('La tabla cambió durante la lectura');
        expected = result.count;
        if (result.data.length === 0 && offset < expected) throw new Error('Paginación incompleta');
        for (const row of result.data) {
          for (const ref of extractReferences(row[source.column])) references.push({ table: source.table, id: row[source.id], column: source.column, ...ref });
        }
        offset += result.data.length;
        if (offset > 100_000 || offset > expected) throw new Error('Límite o conteo de lectura inesperado');
      } while (offset < expected);
      coverage.push({ ...source, rows: offset, complete: true });
    } catch (error) {
      coverage.push({ ...source, rows: offset, complete: false, error: error.code || 'INCOMPLETE_READ' });
    }
  }
  return { references, coverage, complete: coverage.every(item => item.complete) };
}

export async function listObjects(send, command, bucket) {
  const objects = new Map();
  const tokens = new Set();
  let token;
  do {
    const result = await send(new command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of result.Contents || []) objects.set(item.Key, item.Size);
    token = result.NextContinuationToken;
    if (result.IsTruncated && (!token || tokens.has(token))) throw new Error('Inventario R2 incompleto');
    if (token) tokens.add(token);
  } while (token);
  return objects;
}

export function compareReferences(references, objects, publicDomain) {
  return references.map(ref => {
    const location = resolveImageLocation(ref.url, publicDomain);
    if (!location.storage) return { ...ref, status: 'external_or_navigation', legacy: false };
    let key;
    try { key = decodeURIComponent(location.key); }
    catch { return { ...ref, status: 'invalid_key' }; }
    const present = objects.has(key);
    const thumbnailKey = key.endsWith('_thumb.webp') ? key : key.replace(/\.[^/.]+$/, '') + '_thumb.webp';
    return { ...ref, resolved: location.url, key, legacy: location.legacy,
      status: !present ? 'missing' : objects.get(key) === 0 ? 'empty_object' : 'available',
      thumbnailStatus: !objects.has(thumbnailKey) ? 'missing' : objects.get(thumbnailKey) === 0 ? 'empty_object' : 'available' };
  });
}

export async function checkHttpReferences(references, publicDomain, fetchImage) {
  // Solo se comprueban imágenes del almacenamiento conocido. No se visitan enlaces
  // de navegación, dominios externos ni direcciones internas extraídas del contenido.
  const grouped = new Map();
  for (const ref of references) {
    const location = resolveImageLocation(ref.url, publicDomain);
    if (location.storage) grouped.set(location.url.split('#')[0], location);
  }
  const results = [];
  for (const [url] of grouped) {
    try {
      const response = await fetchImage(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      const contentType = response.headers.get('content-type') || '';
      const bytes = response.headers.get('content-length');
      results.push({ url, httpStatus: response.status, status: response.status === 200 && contentType.startsWith('image/') && bytes !== '0' ? 'available' : 'failed' });
    } catch { results.push({ url, status: 'network_error' }); }
  }
  return results;
}
