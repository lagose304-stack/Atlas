import { corsHeaders, json } from './_cloudinary';
import { authorizeEditor } from './_auth';

export async function onRequest(context: { request: Request; env: Record<string, any> }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'DELETE') {
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
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('publicId');
    const rawKey = queryKey || (url.pathname.startsWith('/api/images/') ? url.pathname.slice('/api/images/'.length) : '');
    let publicId: string = '';
    try {
      if (typeof rawKey !== 'string') throw new Error('Invalid key');
      publicId = (queryKey ? rawKey : decodeURIComponent(rawKey)).trim().replace(/^\/+/, '');
    } catch {
      return json(400, { message: 'Clave de imagen inválida' });
    }

    if (!publicId) {
      return json(400, { message: 'Missing publicId parameter' });
    }

    const r2Bucket = env.R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.delete === 'function') {
      await r2Bucket.delete(publicId);

      const thumbKey = publicId.replace(/\.[^.]+$/, '') + '_thumb.webp';
      await r2Bucket.delete(thumbKey);

      return json(200, { message: 'Image deleted successfully from Cloudflare R2.', success: true });
    }

    return json(503, { message: 'Cloudflare R2 bucket binding not configured' });
  } catch (error) {
    return json(500, {
      message: 'No se pudo completar la eliminación en R2',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
