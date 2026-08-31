const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Atlas-Session',
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

const sanitizeFileName = (name) => {
  return (name || 'image.webp')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

const authorizeEditor = async (request, env) => {
  const token = request.headers.get('X-Atlas-Session') || '';
  const url = env.SUPABASE_URL || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!token) return false;

  // Si no se configuró SUPABASE_SERVICE_ROLE_KEY en Cloudflare Pages, permitir si el token está presente
  if (!url || !serviceKey) {
    return true;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/atlas_authorize_token`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_token: token,
        p_roles: ['Administrador', 'Microscopía'],
      }),
    });
    if (!response.ok) return false;
    return (await response.json()) === true;
  } catch {
    return true;
  }
};

const handleUpload = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  if (!(await authorizeEditor(request, env))) {
    return json(401, { message: 'No autorizado: sesión no válida' });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const thumb = formData.get('thumb');
    const targetKey = (formData.get('targetKey') || formData.get('target_key') || '').toString().trim().replace(/^\/+/, '');
    const folder = ((formData.get('folder')) || 'general').toString().replace(/^\/+|\/+$/g, '');

    if (!file || typeof file === 'string') {
      return json(400, { message: 'No se envió ningún archivo de imagen' });
    }

    let uniqueKey = '';
    if (targetKey) {
      uniqueKey = targetKey;
    } else {
      const cleanName = sanitizeFileName(file.name);
      const timestamp = Date.now();
      uniqueKey = `${folder}/${timestamp}_${cleanName}`;
    }

    const r2Bucket = env.R2_BUCKET;
    const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

    if (r2Bucket && typeof r2Bucket.put === 'function') {
      const buffer = await file.arrayBuffer();
      const contentType = file.type || 'image/webp';
      const cacheControl = targetKey
        ? 'public, max-age=60, s-maxage=300, must-revalidate'
        : 'public, max-age=31536000, immutable';

      // 1. Guardar archivo principal
      await r2Bucket.put(uniqueKey, buffer, {
        httpMetadata: {
          contentType,
          cacheControl,
        },
      });

      // 2. Guardar miniatura _thumb.webp si fue provista
      if (thumb && typeof thumb !== 'string') {
        try {
          const thumbBuffer = await thumb.arrayBuffer();
          const thumbKey = uniqueKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
          await r2Bucket.put(thumbKey, thumbBuffer, {
            httpMetadata: {
              contentType: 'image/webp',
              cacheControl,
            },
          });
        } catch (thumbErr) {
          console.warn('[Cloudflare Worker R2] Error guardando miniatura:', thumbErr);
        }
      }

      return json(200, {
        secure_url: `${r2PublicDomain}/${uniqueKey}`,
        public_id: uniqueKey,
        format: contentType.split('/')[1] || 'webp',
        bytes: file.size,
      });
    }

    return json(500, {
      message: 'Cloudflare R2 bucket binding (R2_BUCKET) no está configurado en Cloudflare Pages.',
    });
  } catch (error) {
    return json(500, {
      message: 'Error al subir la imagen a Cloudflare R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

const handleDelete = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'DELETE') {
    return json(405, { message: 'Method not allowed' });
  }

  if (!(await authorizeEditor(request, env))) {
    return json(401, { message: 'No autorizado: sesión no válida' });
  }

  try {
    const url = new URL(request.url);
    const rawKey = url.searchParams.get('publicId') || url.pathname.replace(/^\/api\/images\/?/, '') || '';
    const key = decodeURIComponent(rawKey).replace(/^\/+/, '');

    if (!key) {
      return json(400, { message: 'Falta especificar el public_id o key de la imagen' });
    }

    const r2Bucket = env.R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.delete === 'function') {
      await r2Bucket.delete(key);
      const thumbKey = key.replace(/\.[^.]+$/, '') + '_thumb.webp';
      await r2Bucket.delete(thumbKey).catch(() => {});
      return json(200, { message: 'Operación de eliminación procesada con éxito.', success: true });
    }

    return json(500, { message: 'Cloudflare R2 bucket binding (R2_BUCKET) no configurado en Cloudflare Pages' });
  } catch (error) {
    return json(500, {
      message: 'Error al eliminar imagen en R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

const handleMove = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  if (!(await authorizeEditor(request, env))) {
    return json(401, { message: 'No autorizado: sesión no válida' });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id.replace(/^\/+/, '') : '';
    const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id.replace(/^\/+/, '') : '';

    if (!fromPublicId || !toPublicId) {
      return json(400, { message: 'Faltan parámetros from_public_id o to_public_id' });
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
        // 1. Mover imagen principal
        await r2Bucket.put(toPublicId, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
        });

        if (matchedKey !== toPublicId) {
          await r2Bucket.delete(matchedKey);
        }

        // 2. Mover miniatura asociada si existe
        const fromThumb = matchedKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
        const toThumb = toPublicId.replace(/\.[^.]+$/, '') + '_thumb.webp';
        try {
          const sourceThumbObj = await r2Bucket.get(fromThumb);
          if (sourceThumbObj) {
            await r2Bucket.put(toThumb, sourceThumbObj.body, {
              httpMetadata: sourceThumbObj.httpMetadata,
            });
            if (fromThumb !== toThumb) {
              await r2Bucket.delete(fromThumb);
            }
          }
        } catch (thumbMoveErr) {
          console.warn('[Cloudflare Worker R2] Advertencia moviendo miniatura:', thumbMoveErr);
        }

        return json(200, {
          secure_url: `${r2PublicDomain}/${toPublicId}`,
          public_id: toPublicId,
        });
      }
    }

    return json(404, { message: `No se encontró la imagen '${fromPublicId}' en Cloudflare R2.` });
  } catch (error) {
    return json(500, {
      message: 'Error al mover imagen en R2',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

const handleHealth = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const r2Bucket = env.R2_BUCKET;
  const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');
  return json(200, {
    status: 'ok',
    storage: r2Bucket ? 'cloudflare_r2' : 'none',
    publicDomain: r2PublicDomain,
  });
};

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);

      if (pathname === '/api/images-upload' || pathname === '/api/images/upload') {
        return await handleUpload(request, env);
      }

      if (pathname === '/api/images-delete' || (pathname.startsWith('/api/images/') && pathname !== '/api/images/move')) {
        return await handleDelete(request, env);
      }

      if (pathname === '/api/images-move' || pathname === '/api/images/move') {
        return await handleMove(request, env);
      }

      if (pathname === '/api/health' || pathname === '/api/cloudinary-health') {
        return await handleHealth(request, env);
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
