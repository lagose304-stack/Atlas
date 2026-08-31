import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import multer from 'multer';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

// Cargar variables de entorno locales
dotenv.config({ path: path.resolve(__dirname, '.env') });
if (fs.existsSync(path.resolve(__dirname, 'backend/.env'))) {
  dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });
}

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME || 'atlas-media';
const r2PublicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

let r2Client: S3Client | null = null;
if (r2AccountId && r2AccessKeyId && r2SecretAccessKey) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });
}

const sanitizeFileName = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

function r2DevServerPlugin(): Plugin {
  return {
    name: 'r2-dev-server-api',
    configureServer(server) {
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 35 * 1024 * 1024 },
      });

      server.middlewares.use((req: any, res: any, next: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // Health check
        if (pathname === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ok',
            storage: r2Client ? 'cloudflare_r2' : 'none',
            r2Bucket: r2BucketName,
            publicDomain: r2PublicDomain,
          }));
          return;
        }

        // Upload endpoint: /api/images/upload o /api/images-upload
        if ((pathname === '/api/images/upload' || pathname === '/api/images-upload') && req.method === 'POST') {
          upload.any()(req, res, async (err: any) => {
            if (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Error procesando archivo', error: err.message }));
              return;
            }

            const mainFile = req.file || (req.files && req.files.find((f: any) => f.fieldname === 'file')) || req.files?.[0];
            const thumbUploadFile = req.files && req.files.find((f: any) => f.fieldname === 'thumb');

            if (!mainFile) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'No se envió ningún archivo de imagen' }));
              return;
            }

            if (!r2Client) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Cloudflare R2 no está configurado (faltan variables en backend/.env o .env)' }));
              return;
            }

            try {
              const explicitTargetKey = (req.body?.targetKey || req.body?.target_key || '').trim().replace(/^\/+/, '');
              let uniqueKey = '';

              if (explicitTargetKey) {
                uniqueKey = explicitTargetKey;
              } else {
                const folder = (req.body?.folder || 'general').replace(/^\/+|\/+$/g, '');
                const originalName = mainFile.originalname || 'image.webp';
                const cleanName = sanitizeFileName(originalName);
                const timestamp = Date.now();
                uniqueKey = `${folder}/${timestamp}_${cleanName}`;
              }

              const contentType = mainFile.mimetype || 'image/webp';

              await r2Client.send(new PutObjectCommand({
                Bucket: r2BucketName,
                Key: uniqueKey,
                Body: mainFile.buffer,
                ContentType: contentType,
                CacheControl: explicitTargetKey ? 'public, max-age=60, s-maxage=300, must-revalidate' : 'public, max-age=31536000, immutable',
              }));

              // Generar y subir miniatura optimizada _thumb.webp (usando el buffer del cliente o sharp)
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
                console.log(`[Vite Dev R2 Upload] Miniatura generada con éxito: ${thumbKey}`);
              } catch (thumbErr: any) {
                console.warn(`[Vite Dev R2 Upload] No se pudo generar la miniatura para ${uniqueKey}:`, thumbErr.message);
              }

              const secureUrl = `${r2PublicDomain}/${uniqueKey}`;
              console.log(`[Vite Dev R2 Upload] Archivo subido con éxito: ${uniqueKey}`);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                secure_url: secureUrl,
                public_id: uniqueKey,
                format: contentType.split('/')[1] || 'webp',
                bytes: mainFile.size,
              }));
            } catch (error: any) {
              console.error('[Vite Dev R2 Error]:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Error al subir la imagen a Cloudflare R2', error: error.message }));
            }
          });
          return;
        }

        // Delete endpoint: /api/images-delete o /api/images/...
        if ((pathname === '/api/images-delete' || (pathname.startsWith('/api/images/') && pathname !== '/api/images/upload' && pathname !== '/api/images/move')) && req.method === 'DELETE') {
          const rawKey = url.searchParams.get('publicId') || pathname.replace(/^\/api\/images\/?/, '') || '';
          const key = decodeURIComponent(rawKey).replace(/^\/+/, '');

          if (!key) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Falta especificar el public_id o key de la imagen' }));
            return;
          }

          if (r2Client) {
            Promise.allSettled([
              r2Client.send(new DeleteObjectCommand({
                Bucket: r2BucketName,
                Key: key,
              })),
              r2Client.send(new DeleteObjectCommand({
                Bucket: r2BucketName,
                Key: key.replace(/\.[^.]+$/, '') + '_thumb.webp',
              })),
            ]).then(() => {
              console.log(`[Vite Dev R2 Delete] Objeto y miniatura eliminados: ${key}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Operación de eliminación procesada con éxito.', success: true }));
            }).catch((r2Error: any) => {
              console.warn(`[Vite Dev R2 Delete Warning]:`, r2Error.message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Error al eliminar en R2', error: r2Error.message }));
            });
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Operación de eliminación completada.' }));
          return;
        }

        // Move endpoint: /api/images/move o /api/images-move
        if ((pathname === '/api/images/move' || pathname === '/api/images-move') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk: any) => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const fromPublicId = body.from_public_id?.replace(/^\/+/, '');
              const toPublicId = body.to_public_id?.replace(/^\/+/, '');

              if (!fromPublicId || !toPublicId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'Faltan parámetros from_public_id o to_public_id' }));
                return;
              }

              if (!r2Client) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'Cloudflare R2 no está configurado' }));
                return;
              }

              const candidates = [
                fromPublicId,
                fromPublicId.replace(/^placas_sin_clasificar\//, 'placas/sin_clasificar/'),
                fromPublicId.replace(/^placas\/sin_clasificar\//, 'placas_sin_clasificar/'),
                fromPublicId.endsWith('.webp') ? fromPublicId.replace(/\.webp$/, '') : `${fromPublicId}.webp`,
                fromPublicId.replace(/\.(jpe?g|png|bmp)$/i, '.webp'),
              ];
              const uniqueCandidates = Array.from(new Set(candidates));

              let copied = false;
              let matchedSourceKey = fromPublicId;
              let lastErr: any = null;

              for (const candidate of uniqueCandidates) {
                try {
                  await r2Client.send(new CopyObjectCommand({
                    Bucket: r2BucketName,
                    CopySource: `${r2BucketName}/${candidate}`,
                    Key: toPublicId,
                  }));
                  copied = true;
                  matchedSourceKey = candidate;
                  break;
                } catch (e: any) {
                  lastErr = e;
                }
              }

              if (!copied) {
                throw lastErr || new Error(`No se pudo copiar el archivo '${fromPublicId}' en R2`);
              }

              if (matchedSourceKey !== toPublicId) {
                await r2Client.send(new DeleteObjectCommand({
                  Bucket: r2BucketName,
                  Key: matchedSourceKey,
                }));
              }

              // También mover la miniatura asociada si existe
              const fromThumb = matchedSourceKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
              const toThumb = toPublicId.replace(/\.[^.]+$/, '') + '_thumb.webp';
              try {
                await r2Client.send(new CopyObjectCommand({
                  Bucket: r2BucketName,
                  CopySource: `${r2BucketName}/${fromThumb}`,
                  Key: toThumb,
                }));
                if (fromThumb !== toThumb) {
                  await r2Client.send(new DeleteObjectCommand({
                    Bucket: r2BucketName,
                    Key: fromThumb,
                  }));
                }
              } catch {
                // Miniatura previa puede no existir
              }

              const secureUrl = `${r2PublicDomain}/${toPublicId}`;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ secure_url: secureUrl, public_id: toPublicId }));
            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Error al mover la imagen en R2', error: error.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), r2DevServerPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
});

