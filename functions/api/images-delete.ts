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

  if (!(await authorizeEditor(request, env))) {
    return json(401, { message: 'Unauthorized' });
  }

  try {
    const url = new URL(request.url);
    const rawPublicId = url.searchParams.get('publicId') || '';
    const publicId = decodeURIComponent(rawPublicId).replace(/^\/+/, '');

    if (!publicId) {
      return json(400, { message: 'Missing publicId parameter' });
    }

    const r2Bucket = env.R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.delete === 'function') {
      await r2Bucket.delete(publicId);
      return json(200, { message: 'Image deleted successfully from Cloudflare R2.', success: true });
    }

    return json(500, { message: 'Cloudflare R2 bucket binding not configured' });
  } catch (error) {
    return json(500, {
      message: 'Error deleting image from R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
