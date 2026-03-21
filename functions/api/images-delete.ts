import { callCloudinary, corsHeaders, json } from './_cloudinary';

export async function onRequest(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'DELETE') {
    return json(405, { message: 'Method not allowed' });
  }

  try {
    const url = new URL(request.url);
    const publicId = url.searchParams.get('publicId') || '';

    if (!publicId) {
      return json(400, { message: 'Missing publicId parameter' });
    }

    const { ok, data } = await callCloudinary('destroy', { public_id: publicId }, env);

    if (!ok) {
      return json(500, { message: 'Cloudinary destroy request failed', error: data });
    }

    if (data.result === 'ok' || data.result === 'not found') {
      return json(200, { message: 'Cloudinary delete processed.' });
    }

    return json(500, { message: 'Cloudinary could not delete the image', result: data });
  } catch (error) {
    return json(500, {
      message: 'Error deleting image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
