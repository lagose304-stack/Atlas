import { callCloudinary, corsHeaders, json } from './_cloudinary';

export async function onRequest(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id : '';
    const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id : '';

    if (!fromPublicId || !toPublicId) {
      return json(400, { message: 'Missing from_public_id or to_public_id' });
    }

    const { ok, data } = await callCloudinary(
      'rename',
      {
        from_public_id: fromPublicId,
        to_public_id: toPublicId,
        overwrite: 'true',
      },
      env
    );

    if (!ok) {
      return json(500, { message: 'Cloudinary rename request failed', error: data });
    }

    return json(200, {
      secure_url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (error) {
    return json(500, {
      message: 'Error moving image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
