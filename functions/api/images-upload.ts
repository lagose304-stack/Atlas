import { authorizeEditor } from './_auth';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Atlas-Session',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });

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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = ((formData.get('folder') as string) || 'general').replace(/^\/+|\/+$/g, '');

    if (!file) {
      return json(400, { message: 'No file provided in form data' });
    }

    const originalName = file.name || 'image.webp';
    const cleanName = originalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]/g, '_');
    const timestamp = Date.now();
    const uniqueKey = `${folder}/${timestamp}_${cleanName}`;

    const r2Bucket = env.R2_BUCKET;
    const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

    // Caso 1: Binding nativo de R2 en Cloudflare Pages
    if (r2Bucket && typeof r2Bucket.put === 'function') {
      const buffer = await file.arrayBuffer();
      await r2Bucket.put(uniqueKey, buffer, {
        httpMetadata: {
          contentType: file.type || 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });

      return json(200, {
        secure_url: `${r2PublicDomain}/${uniqueKey}`,
        public_id: uniqueKey,
        format: file.type.split('/')[1] || 'webp',
        bytes: file.size,
      });
    }

    return json(500, {
      message: 'R2 bucket binding (R2_BUCKET) is not configured in Cloudflare Pages',
    });
  } catch (error) {
    return json(500, {
      message: 'Error uploading to R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
