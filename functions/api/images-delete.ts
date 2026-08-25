import { callCloudinary, corsHeaders, json } from './_cloudinary';
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

    let deleted = false;

    // 1. Intento R2
    const r2Bucket = env.R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.delete === 'function') {
      try {
        await r2Bucket.delete(publicId);
        deleted = true;
      } catch (err) {
        console.warn('R2 delete warning:', err);
      }
    }

    // 2. Fallback Cloudinary si aplica
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      try {
        const { ok, data } = await callCloudinary('destroy', { public_id: publicId }, env);
        if (ok && (data.result === 'ok' || data.result === 'not found')) {
          deleted = true;
        }
      } catch (cldErr) {
        console.warn('Cloudinary delete warning:', cldErr);
      }
    }

    return json(200, { message: 'Delete operation completed.', success: true });
  } catch (error) {
    return json(500, {
      message: 'Error deleting image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
