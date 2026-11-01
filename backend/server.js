const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');

// --- Configuración de Cloudflare R2 ---
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME || 'atlas-media';
const r2PublicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

let r2Client = null;
if (r2AccountId && r2AccessKeyId && r2SecretAccessKey) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });
  console.log('✅ Cloudflare R2 configurado correctamente.');
} else {
  console.warn('⚠️ Faltan credenciales de Cloudflare R2 en backend/.env');
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 }, // Límite de 35MB
});

// Middlewares
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Atlas-Session'],
}));
app.use(express.json());

const servePublicPlateImage = async (request, publicDomain) => {
  const error = (status, message) => new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return error(405, 'Método no permitido.');
  let source;
  try {
    source = new URL(new URL(request.url).searchParams.get('url') || '');
    const allowed = new URL(publicDomain);
    const prefix = allowed.pathname.replace(/\/+$/, '');
    if (source.protocol !== 'https:' || source.origin !== allowed.origin || source.username || source.password || (prefix && !source.pathname.startsWith(`${prefix}/`)) || !/\.(webp|png|jpe?g)$/i.test(source.pathname)) return error(400, 'La imagen debe pertenecer al almacenamiento público de Atlas.');
  } catch { return error(400, 'Dirección de imagen inválida.'); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const limit = 32 * 1024 * 1024;
  try {
    const response = await fetch(source.href, { redirect: 'error', signal: controller.signal });
    if (!response.ok) return error(response.status === 404 ? 404 : 502, 'No se pudo leer la imagen pública.');
    const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(type)) { await response.body?.cancel(); return error(415, 'Formato de imagen no compatible.'); }
    if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); return error(413, 'La imagen supera el tamaño permitido.'); }
    const reader = response.body?.getReader();
    if (!reader) return error(502, 'La imagen está vacía.');
    const chunks = [];
    let length = 0;
    while (true) {
      const result = await reader.read();
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
  finally { clearTimeout(timer); }
};

app.get('/api/plate-image', async (req, res) => {
  const request = new Request(`http://atlas.local${req.originalUrl}`, { method: req.method });
  const response = await servePublicPlateImage(request, r2PublicDomain || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev');
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
});

const getEditorAuthorizationStatus = async (sessionToken) => {
  const token = (sessionToken || '').trim();
  if (!token) return 401;
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

const authorizeEditor = async (req, res, next) => {
  const status = await getEditorAuthorizationStatus(req.get('X-Atlas-Session'));
  if (status !== 200) {
    return res.status(status).json({ message: status === 401 ? 'Falta la sesión de Atlas'
      : status === 403 ? 'Permisos insuficientes' : 'No se pudo verificar la sesión de Atlas' });
  }
  return next();
};

const sharp = require('sharp');

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: r2Client ? 'cloudflare_r2' : 'none',
    r2Bucket: r2BucketName,
    publicDomain: r2PublicDomain,
  });
});

// Helper para limpiar nombres de archivo seguros
const sanitizeFileName = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

// 1. Ruta para SUBIR imagen a Cloudflare R2 con generación de miniatura _thumb.webp
app.post(['/api/images/upload', '/api/images-upload'], authorizeEditor, upload.any(), async (req, res) => {
  const mainFile = req.file || (req.files && req.files.find(f => f.fieldname === 'file')) || (req.files && req.files[0]);
  const thumbUploadFile = req.files && req.files.find(f => f.fieldname === 'thumb');

  if (!mainFile) {
    return res.status(400).json({ message: 'No se envió ningún archivo de imagen' });
  }

  if (!r2Client) {
    return res.status(503).json({ message: 'Cloudflare R2 no está configurado en el backend' });
  }

  try {
    const explicitTargetKey = (req.body.targetKey || req.body.target_key || '').trim().replace(/^\/+/, '');
    let uniqueKey = '';

    if (explicitTargetKey) {
      uniqueKey = explicitTargetKey;
    } else {
      const folder = (req.body.folder || 'general').replace(/^\/+|\/+$/g, '');
      const originalName = mainFile.originalname || 'image.webp';
      const cleanName = sanitizeFileName(originalName);
      const timestamp = Date.now();
      uniqueKey = `${folder}/${timestamp}_${cleanName}`;
    }

    const contentType = mainFile.mimetype || 'image/webp';

    // Subir imagen original principal
    await r2Client.send(new PutObjectCommand({
      Bucket: r2BucketName,
      Key: uniqueKey,
      Body: mainFile.buffer,
      ContentType: contentType,
      CacheControl: explicitTargetKey ? 'public, max-age=60, s-maxage=300, must-revalidate' : 'public, max-age=31536000, immutable',
    }));

    // Generar y subir miniatura optimizada _thumb.webp
    try {
      const thumbKey = uniqueKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
      const thumbBuffer = thumbUploadFile?.buffer || await sharp(mainFile.buffer)
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();

      await r2Client.send(new PutObjectCommand({
        Bucket: r2BucketName,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: 'image/webp',
        CacheControl: explicitTargetKey ? 'public, max-age=60, s-maxage=300, must-revalidate' : 'public, max-age=31536000, immutable',
      }));
      console.log(`[R2 Upload] Miniatura generada con éxito: ${thumbKey}`);
    } catch (thumbErr) {
      console.warn(`[R2 Upload] No se pudo generar la miniatura para ${uniqueKey}:`, thumbErr.message);
    }

    const secureUrl = `${r2PublicDomain}/${uniqueKey}`;

    console.log(`[R2 Upload] Archivo subido con éxito: ${uniqueKey}`);

    return res.status(200).json({
      secure_url: secureUrl,
      public_id: uniqueKey,
      format: contentType.split('/')[1] || 'webp',
      bytes: mainFile.size,
    });
  } catch (error) {
    console.error('Error al subir imagen a R2:', error);
    res.status(500).json({ message: 'Error al subir la imagen a Cloudflare R2', error: error.message });
  }
});

// 2. Ruta para ELIMINAR imagen de R2 (incluyendo su miniatura si existe)
const handleDeleteImage = async (req, res) => {
  const queryKey = req.query.publicId;
  const rawKey = queryKey || (req.path.startsWith('/api/images/') ? req.path.slice('/api/images/'.length) : '');
  let key = '';
  try {
    if (typeof rawKey !== 'string') throw new Error('Invalid key');
    key = (queryKey ? rawKey : decodeURIComponent(rawKey)).trim().replace(/^\/+/, '');
  } catch {
    return res.status(400).json({ message: 'Clave de imagen inválida' });
  }

  if (!key) {
    return res.status(400).json({ message: 'Falta especificar el public_id o key de la imagen' });
  }

  console.log(`[Delete] Intentando eliminar de R2: ${key}`);

  if (r2Client) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      }));
      console.log(`[R2 Delete] Objeto eliminado de R2: ${key}`);

      // R2 considera exitoso borrar un objeto inexistente; un rechazo es un fallo real.
      const thumbKey = key.replace(/\.[^.]+$/, '') + '_thumb.webp';
      await r2Client.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: thumbKey }));

      return res.status(200).json({ message: 'Operación de eliminación procesada con éxito.', success: true });
    } catch (r2Error) {
      console.warn(`[R2 Delete Warning] No se pudo borrar en R2 (${key}):`, r2Error.message);
      return res.status(500).json({ message: 'No se pudo completar la eliminación en R2', success: false });
    }
  }

  res.status(503).json({ message: 'Cloudflare R2 no está configurado', success: false });
};

app.delete('/api/images-delete', authorizeEditor, handleDeleteImage);
app.delete(/^\/api\/images\/(.+)$/, authorizeEditor, handleDeleteImage);

// 3. Ruta para MOVER/RENOMBRAR imagen en R2 (y su miniatura)
const handleMoveImage = async (req, res) => {
  const { from_public_id, to_public_id } = req.body || {};
  if (typeof from_public_id !== 'string' || !from_public_id.trim() || typeof to_public_id !== 'string' || !to_public_id.trim()) {
    return res.status(400).json({ message: 'Faltan parámetros from_public_id o to_public_id' });
  }

  if (!r2Client) {
    return res.status(503).json({ message: 'Cloudflare R2 no está configurado' });
  }

  const cleanFrom = from_public_id.replace(/^\/+/, '');
  const cleanTo = to_public_id.replace(/^\/+/, '');

  try {
    const destinationKey = cleanTo.replace(/(\.[^/.]+)?$/, (extension = '') => `_${randomUUID()}${extension}`);

    const candidates = [
      cleanFrom,
      cleanFrom.replace(/^placas_sin_clasificar\//, 'placas/sin_clasificar/'),
      cleanFrom.replace(/^placas\/sin_clasificar\//, 'placas_sin_clasificar/'),
      cleanFrom.endsWith('.webp') ? cleanFrom.replace(/\.webp$/, '') : `${cleanFrom}.webp`,
      cleanFrom.replace(/\.(jpe?g|png|bmp)$/i, '.webp'),
    ];
    const uniqueCandidates = Array.from(new Set(candidates));

    let copied = false;
    let matchedSourceKey = cleanFrom;
    let lastErr = null;

    for (const candidate of uniqueCandidates) {
      try {
        await r2Client.send(new CopyObjectCommand({
          Bucket: r2BucketName,
          CopySource: `${r2BucketName}/${candidate}`,
          Key: destinationKey,
        }));
        copied = true;
        matchedSourceKey = candidate;
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!copied) {
      throw lastErr || new Error(`No se pudo copiar el archivo '${cleanFrom}' en R2`);
    }

    // Conservar el origen: puede estar referenciado en otras páginas.

    // Copiar también la miniatura asociada si existe
    const fromThumb = matchedSourceKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
    const toThumb = destinationKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
    try {
      await r2Client.send(new CopyObjectCommand({
        Bucket: r2BucketName,
        CopySource: `${r2BucketName}/${fromThumb}`,
        Key: toThumb,
      }));
    } catch (_) {}

    const secureUrl = `${r2PublicDomain}/${destinationKey}`;
    res.status(200).json({ secure_url: secureUrl, public_id: destinationKey });
  } catch (error) {
    console.error('Error al mover imagen en R2:', error);
    res.status(500).json({ message: 'Error al mover la imagen en R2', error: error.message });
  }
};

app.post('/api/images/move', authorizeEditor, handleMoveImage);
app.post('/api/images-move', authorizeEditor, handleMoveImage);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT} (R2 listo)`);
});
