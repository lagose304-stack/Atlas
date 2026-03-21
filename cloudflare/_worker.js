const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  });

const getCloudinaryConfig = (env) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = env.CLOUDINARY_API_KEY || '';
  const apiSecret = env.CLOUDINARY_API_SECRET || '';

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
  }

  return { cloudName, apiKey, apiSecret };
};

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const sha1 = async (value) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return toHex(hash);
};

const signParams = async (params, apiSecret) => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return sha1(`${serialized}${apiSecret}`);
};

const callCloudinary = async (endpoint, unsignedParams, env) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signatureParams = {
    ...unsignedParams,
    timestamp,
  };

  const signature = await signParams(signatureParams, apiSecret);

  const body = new URLSearchParams({
    ...unsignedParams,
    timestamp,
    api_key: apiKey,
    signature,
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  return { ok: response.ok, data };
};

const handleDelete = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'DELETE') {
    return json(405, { message: 'Method not allowed' });
  }

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
};

const handleMove = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

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
};

const handleCloudinaryHealth = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }

  const hasCloudName = Boolean(env.CLOUDINARY_CLOUD_NAME);
  const hasApiKey = Boolean(env.CLOUDINARY_API_KEY);
  const hasApiSecret = Boolean(env.CLOUDINARY_API_SECRET);

  if (!hasCloudName || !hasApiKey || !hasApiSecret) {
    return json(500, {
      ok: false,
      message: 'Missing Cloudinary env vars in production',
      env: {
        CLOUDINARY_CLOUD_NAME: hasCloudName,
        CLOUDINARY_API_KEY: hasApiKey,
        CLOUDINARY_API_SECRET: hasApiSecret,
      },
    });
  }

  const probePublicId = '__atlas_healthcheck__/does-not-exist';
  const probe = await callCloudinary('destroy', { public_id: probePublicId }, env);

  return json(probe.ok ? 200 : 500, {
    ok: probe.ok,
    message: probe.ok ? 'Cloudinary credentials are working' : 'Cloudinary credentials failed',
    env: {
      CLOUDINARY_CLOUD_NAME: true,
      CLOUDINARY_API_KEY: true,
      CLOUDINARY_API_SECRET: true,
    },
    cloudinary: probe.data,
  });
};

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);

      if (pathname === '/api/images-delete') {
        return await handleDelete(request, env);
      }

      if (pathname === '/api/images-move') {
        return await handleMove(request, env);
      }

      if (pathname === '/api/cloudinary-health') {
        return await handleCloudinaryHealth(request, env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json(500, {
        message: 'Unhandled worker error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
