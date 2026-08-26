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

  if (!(await authorizeEditor(request, env))) {
    return json(401, { message: 'Unauthorized' });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id.replace(/^\/+/, '') : '';
    const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id.replace(/^\/+/, '') : '';

    if (!fromPublicId || !toPublicId) {
      return json(400, { message: 'Missing from_public_id or to_public_id' });
    }

    const r2Bucket = env.R2_BUCKET;
    const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

    if (r2Bucket && typeof r2Bucket.get === 'function' && typeof r2Bucket.put === 'function') {
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
        await r2Bucket.put(toPublicId, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
        });

        // Solo eliminar el origen si es diferente al destino
        if (matchedKey !== toPublicId) {
          await r2Bucket.delete(matchedKey);
        }

        return json(200, {
          secure_url: `${r2PublicDomain}/${toPublicId}`,
          public_id: toPublicId,
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
