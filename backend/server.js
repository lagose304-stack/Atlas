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

// --- Configuración opcional de Cloudinary (Fallback retrocompatible) ---
let cloudinary = null;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (cloudName && apiKey && apiSecret) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  console.log('ℹ️ Cloudinary configurado como fallback.');
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

const authorizeEditor = async (req, res, next) => {
  const token = req.get('X-Atlas-Session') || '';
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!token) {
    return res.status(401).json({ message: 'No autorizado: falta sesión de Atlas' });
  }

  if (supabaseUrl && serviceKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/atlas_authorize_token`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_token: token, p_roles: ['Administrador', 'Microscopía'] }),
      });
      if (!response.ok || await response.json() !== true) {
        return res.status(403).json({ message: 'Permisos insuficientes' });
      }
      return next();
    } catch (error) {
      console.error('Error validando sesion administrativa:', error);
      return res.status(503).json({ message: 'No se pudo validar la sesion' });
    }
  }

  return next();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: r2Client ? 'cloudflare_r2' : (cloudinary ? 'cloudinary' : 'none'),
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

// 1. Ruta para SUBIR imagen a Cloudflare R2
app.post('/api/images/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se envió ningún archivo de imagen' });
  }

  if (!r2Client) {
    return res.status(500).json({ message: 'Cloudflare R2 no está configurado en el backend' });
  }

  try {
    const folder = (req.body.folder || 'general').replace(/^\/+|\/+$/g, '');
    const originalName = req.file.originalname || 'image.webp';
    const cleanName = sanitizeFileName(originalName);
    const timestamp = Date.now();
    const uniqueKey = `${folder}/${timestamp}_${cleanName}`;

    const contentType = req.file.mimetype || 'image/webp';

    await r2Client.send(new PutObjectCommand({
      Bucket: r2BucketName,
      Key: uniqueKey,
      Body: req.file.buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const secureUrl = `${r2PublicDomain}/${uniqueKey}`;

    console.log(`[R2 Upload] Archivo subido con éxito: ${uniqueKey}`);

    res.status(200).json({
      secure_url: secureUrl,
      public_id: uniqueKey,
      format: contentType.split('/')[1] || 'webp',
      bytes: req.file.size,
    });
  } catch (error) {
    console.error('Error al subir imagen a R2:', error);
    res.status(500).json({ message: 'Error al subir la imagen a Cloudflare R2', error: error.message });
  }
});

// 2. Ruta para ELIMINAR imagen de R2 (con fallback a Cloudinary si es necesario)
const handleDeleteImage = async (req, res) => {
  const rawKey = req.query.publicId || req.path.replace(/^\/api\/images\/?/, '') || '';
  const key = decodeURIComponent(rawKey).replace(/^\/+/, '');

  if (!key) {
    return res.status(400).json({ message: 'Falta especificar el public_id o key de la imagen' });
  }

  console.log(`[Delete] Intentando eliminar: ${key}`);

  let deleted = false;

  if (r2Client) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      }));
      deleted = true;
      console.log(`[R2 Delete] Objeto eliminado de R2: ${key}`);
    } catch (r2Error) {
      console.warn(`[R2 Delete Warning] No se pudo borrar en R2 (${key}):`, r2Error.message);
    }
  }

  if (cloudinary) {
    try {
      const cldResult = await cloudinary.uploader.destroy(key);
      if (cldResult.result === 'ok' || cldResult.result === 'not found') {
        deleted = true;
      }
    } catch (cldError) {
      console.warn(`[Cloudinary Delete Warning] (${key}):`, cldError.message);
    }
  }

  if (deleted) {
    return res.status(200).json({ message: 'Operación de eliminación procesada con éxito.' });
  }

  res.status(200).json({ message: 'Operación de eliminación completada.' });
};

app.delete('/api/images-delete', authorizeEditor, handleDeleteImage);
app.delete(/^\/api\/images\/(.+)$/, authorizeEditor, handleDeleteImage);

// 3. Ruta para MOVER/RENOMBRAR imagen en R2
const handleMoveImage = async (req, res) => {
  const { from_public_id, to_public_id } = req.body;
  if (!from_public_id || !to_public_id) {
    return res.status(400).json({ message: 'Faltan parámetros from_public_id o to_public_id' });
  }

  if (!r2Client) {
    return res.status(500).json({ message: 'Cloudflare R2 no está configurado' });
  }

  try {
    await r2Client.send(new CopyObjectCommand({
      Bucket: r2BucketName,
      CopySource: `${r2BucketName}/${from_public_id}`,
      Key: to_public_id,
    }));

    await r2Client.send(new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: from_public_id,
    }));

    const secureUrl = `${r2PublicDomain}/${to_public_id}`;
    res.status(200).json({ secure_url: secureUrl, public_id: to_public_id });
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
