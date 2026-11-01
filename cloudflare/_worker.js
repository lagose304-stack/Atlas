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
  const token = (request.headers.get('X-Atlas-Session') || '').trim();
  if (!token) return 401;
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) return 503;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/atlas_authorize_token`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token, p_roles: ['Administrador', 'Microscopía'] }),
    });
    if (!response.ok) return 503;
    const allowed = await response.json();
    return allowed === true ? 200 : allowed === false ? 403 : 503;
  } catch {
    return 503;
  }
};

const handleUpload = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
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

    return json(503, {
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
    let key = '';
    try {
      if (typeof rawKey !== 'string') throw new Error('Invalid key');
      key = (queryKey ? rawKey : decodeURIComponent(rawKey)).trim().replace(/^\/+/, '');
    } catch {
      return json(400, { message: 'Clave de imagen inválida' });
    }

    if (!key) {
      return json(400, { message: 'Falta especificar el public_id o key de la imagen' });
    }

    const r2Bucket = env.R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.delete === 'function') {
      await r2Bucket.delete(key);
      const thumbKey = key.replace(/\.[^.]+$/, '') + '_thumb.webp';
      await r2Bucket.delete(thumbKey);
      return json(200, { message: 'Operación de eliminación procesada con éxito.', success: true });
    }

    return json(503, { message: 'Cloudflare R2 bucket binding (R2_BUCKET) no configurado en Cloudflare Pages' });
  } catch (error) {
    return json(500, {
      message: 'No se pudo completar la eliminación en R2',
      success: false,
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

  const authorizationStatus = await authorizeEditor(request, env);
  if (authorizationStatus !== 200) {
    return json(authorizationStatus, {
      message: authorizationStatus === 401 ? 'Falta la sesión de Atlas'
        : authorizationStatus === 403 ? 'Permisos insuficientes'
        : 'No se pudo verificar la sesión de Atlas',
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id.trim().replace(/^\/+/, '') : '';
    const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id.trim().replace(/^\/+/, '') : '';

    if (!fromPublicId || !toPublicId) {
      return json(400, { message: 'Faltan parámetros from_public_id o to_public_id' });
    }

    const r2Bucket = env.R2_BUCKET;
    const r2PublicDomain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

    if (!r2Bucket || typeof r2Bucket.get !== 'function' || typeof r2Bucket.put !== 'function') {
      return json(503, { message: 'Cloudflare R2 no está configurado' });
    }

    if (r2Bucket && typeof r2Bucket.get === 'function' && typeof r2Bucket.put === 'function') {
      const destinationKey = toPublicId.replace(/(\.[^/.]+)?$/, (extension = '') => `_${crypto.randomUUID()}${extension}`);

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
        // 1. Copiar imagen principal conservando el origen
        await r2Bucket.put(destinationKey, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
        });

        // Conservar el origen y sus referencias existentes.

        // 2. Copiar miniatura asociada si existe
        const fromThumb = matchedKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
        const toThumb = destinationKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
        try {
          const sourceThumbObj = await r2Bucket.get(fromThumb);
          if (sourceThumbObj) {
            await r2Bucket.put(toThumb, sourceThumbObj.body, {
              httpMetadata: sourceThumbObj.httpMetadata,
            });
          }
        } catch (thumbMoveErr) {
          console.warn('[Cloudflare Worker R2] Advertencia moviendo miniatura:', thumbMoveErr);
        }

        return json(200, {
          secure_url: `${r2PublicDomain}/${destinationKey}`,
          public_id: destinationKey,
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

const servePublicPlateImage = async (request, publicDomain, bucket) => {
  const error = (status, message) => new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return error(405, 'Método no permitido.');
  let source, key;
  try {
    source = new URL(new URL(request.url).searchParams.get('url') || '');
    const allowed = new URL(publicDomain);
    const prefix = allowed.pathname.replace(/\/+$/, '');
    if (source.protocol !== 'https:' || source.origin !== allowed.origin || source.username || source.password || (prefix && !source.pathname.startsWith(`${prefix}/`)) || !/\.(webp|png|jpe?g)$/i.test(source.pathname)) return error(400, 'La imagen debe pertenecer al almacenamiento público de Atlas.');
    key = decodeURIComponent(source.pathname.slice(prefix.length + 1));
  } catch { return error(400, 'Dirección de imagen inválida.'); }
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Tiempo de lectura agotado')); }, 20000);
  });
  let reader;
  const limit = 32 * 1024 * 1024;
  try {
    // En Pages se lee el objeto mediante el binding, sin volver al dominio público de R2.
    // La URL ya fue validada; los parámetros de caché no forman parte de la clave.
    let response;
    if (bucket && typeof bucket.get === 'function') {
      const object = await Promise.race([bucket.get(key), expired]);
      if (!object) return error(404, 'No se pudo leer la imagen pública.');
      response = new Response(object.body, { headers: {
        'Content-Type': object.httpMetadata?.contentType || '',
        'Content-Length': String(object.size),
      } });
    } else {
      response = await Promise.race([fetch(source.href, { redirect: 'error', signal: controller.signal }), expired]);
    }
    if (!response.ok) return error(response.status === 404 ? 404 : 502, 'No se pudo leer la imagen pública.');
    const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(type)) { await response.body?.cancel(); return error(415, 'Formato de imagen no compatible.'); }
    if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); return error(413, 'La imagen supera el tamaño permitido.'); }
    reader = response.body?.getReader();
    if (!reader) return error(502, 'La imagen está vacía.');
    const chunks = [];
    let length = 0;
    while (true) {
      const result = await Promise.race([reader.read(), expired]);
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limit) { await reader.cancel(); return error(413, 'La imagen supera el tamaño permitido.'); }
      chunks.push(result.value);
    }
    if (!length) return error(502, 'La imagen está vacía.');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { headers: { 'Content-Type': type, 'Content-Length': String(length), 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return error(502, 'No se pudo descargar la imagen. Inténtalo de nuevo.'); }
  finally { clearTimeout(timer); if (controller.signal.aborted) await reader?.cancel().catch(() => {}); }
};

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/plate-image') {
        return await servePublicPlateImage(request, env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev', env.R2_BUCKET);
      }


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
