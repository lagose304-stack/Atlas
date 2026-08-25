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
      const sourceObj = await r2Bucket.get(fromPublicId);
      if (sourceObj) {
        await r2Bucket.put(toPublicId, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
        });
        await r2Bucket.delete(fromPublicId);

        return json(200, {
          secure_url: `${r2PublicDomain}/${toPublicId}`,
          public_id: toPublicId,
        });
      }
    }

    return json(404, { message: 'Image could not be found in Cloudflare R2.' });
  } catch (error) {
    return json(500, {
      message: 'Error moving image in R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
