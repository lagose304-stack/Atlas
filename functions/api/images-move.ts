import { corsHeaders, json } from './_cloudinary';
import { authorizeEditor } from './_auth';

export async function onRequest(context: { request: Request; env: Record<string, any> }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  const authorizationStatus = await authorizeEditor(request, env);
  if (authorizationStatus !== 200) {
    return json(authorizationStatus, {
      message: authorizationStatus === 401 ? 'Falta la sesión de Atlas'
        : authorizationStatus === 403 ? 'Permisos insuficientes'
        : 'No se pudo verificar la sesión de Atlas',
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id.trim().replace(/^\/+/, '') : '';
    const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id.trim().replace(/^\/+/, '') : '';

    if (!fromPublicId || !toPublicId) {
      return json(400, { message: 'Missing from_public_id or to_public_id' });
    }

    const r2Bucket = env.R2_BUCKET;
    const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

    if (!r2Bucket || typeof r2Bucket.get !== 'function' || typeof r2Bucket.put !== 'function') {
      return json(503, { message: 'Cloudflare R2 no está configurado' });
    }

    if (r2Bucket && typeof r2Bucket.get === 'function' && typeof r2Bucket.put === 'function') {
      const destinationKey = toPublicId.replace(/(\.[^/.]+)?$/, (extension = '') => `_${crypto.randomUUID()}${extension}`);

      const candidates = [
        fromPublicId,
        fromPublicId.replace(/^placas_sin_clasificar\//, 'placas/sin_clasificar/'),
        fromPublicId.replace(/^placas\/sin_clasificar\//, 'placas_sin_clasificar/'),
        fromPublicId.endsWith('.webp') ? fromPublicId.replace(/\.webp$/, '') : `${fromPublicId}.webp`,
        fromPublicId.replace(/\.(jpe?g|png|bmp)$/i, '.webp'),
      ];
      const uniqueCandidates = Array.from(new Set(candidates));

      let sourceObj = null;
      let matchedKey = fromPublicId;

      for (const candidate of uniqueCandidates) {
        sourceObj = await r2Bucket.get(candidate);
        if (sourceObj) {
          matchedKey = candidate;
          break;
        }
      }

      if (sourceObj) {
        await r2Bucket.put(destinationKey, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
        });

        // Conservar el origen y sus referencias existentes.

        // Copiar también la miniatura, sin eliminarla del origen.
        const fromThumb = matchedKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
        const toThumb = destinationKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
        try {
          const thumbnail = await r2Bucket.get(fromThumb);
          if (thumbnail) await r2Bucket.put(toThumb, thumbnail.body, { httpMetadata: thumbnail.httpMetadata });
        } catch (error) {
          console.warn('No se pudo copiar la miniatura en R2:', error);
        }

        return json(200, {
          secure_url: `${r2PublicDomain}/${destinationKey}`,
          public_id: destinationKey,
        });
      }
    }

    return json(404, { message: `Image '${fromPublicId}' could not be found in Cloudflare R2.` });
  } catch (error) {
    return json(500, {
      message: 'Error moving image in R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
