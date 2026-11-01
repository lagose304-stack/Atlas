import { randomUUID } from 'node:crypto';
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

const getEditorAuthorizationStatus = async (sessionToken: string): Promise<number> => {
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

const servePublicPlateImage = async (request: Request, publicDomain: string) => {
  const error = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
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
    const chunks: Uint8Array[] = [];
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

function r2DevServerPlugin(): Plugin {
  return {
    name: 'r2-dev-server-api',
    configureServer(server) {
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 35 * 1024 * 1024 },
      });

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        if (pathname === '/api/plate-image') {
          const response = await servePublicPlateImage(new Request(url.href, { method: req.method }), r2PublicDomain);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }

        // Servir archivos estáticos locales cuando se accede vía /@fs/ entre diferentes unidades (ej. D: y C:)
        if (pathname.startsWith('/@fs/')) {
          const match = pathname.match(/^\/@fs\/([A-Za-z]:\/[^\?#]+)/);
          if (match) {
            const fsPath = decodeURIComponent(match[1]);
            if (fs.existsSync(fsPath)) {
              try {
                const stat = fs.statSync(fsPath);
                if (stat.isFile()) {
                  const ext = path.extname(fsPath).toLowerCase();
                  const mimeTypes: Record<string, string> = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml',
                    '.ico': 'image/x-icon',
                    '.gif': 'image/gif',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                  };
                  if (mimeTypes[ext]) {
                    res.setHeader('Content-Type', mimeTypes[ext]);
                    res.setHeader('Content-Length', stat.size);
                    res.setHeader('Cache-Control', 'no-cache');
                    fs.createReadStream(fsPath).pipe(res);
                    return;
                  }
                }
              } catch (_) {
                // Continuar si falla lectura
              }
            }
          }
        }

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

        const isImageMutation = (req.method === 'POST' || req.method === 'DELETE')
          && (pathname.startsWith('/api/images/') || ['/api/images-upload', '/api/images-delete', '/api/images-move'].includes(pathname));
        if (isImageMutation) {
          const header = req.headers['x-atlas-session'];
          const status = await getEditorAuthorizationStatus(typeof header === 'string' ? header : '');
          if (status !== 200) {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: status === 401 ? 'Falta la sesión de Atlas'
              : status === 403 ? 'Permisos insuficientes' : 'No se pudo verificar la sesión de Atlas' }));
            return;
          }
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
              res.statusCode = 503;
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
          const queryKey = url.searchParams.get('publicId');
          const rawKey = queryKey || (pathname.startsWith('/api/images/') ? pathname.slice('/api/images/'.length) : '');
          let key: string = '';
          try {
            if (typeof rawKey !== 'string') throw new Error('Invalid key');
            key = (queryKey ? rawKey : decodeURIComponent(rawKey)).trim().replace(/^\/+/, '');
          } catch {
            res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ message: 'Clave de imagen inválida' })); return;
          }

          if (!key) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Falta especificar el public_id o key de la imagen' }));
            return;
          }

          if (r2Client) {
            // Secuencial: si falla el original, conservar su miniatura.
            (async () => {
              await r2Client.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: key }));
              await r2Client.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: key.replace(/\.[^.]+$/, '') + '_thumb.webp' }));
            })().then(() => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Operación de eliminación procesada con éxito.', success: true }));
            }).catch(() => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'No se pudo completar la eliminación en R2', success: false }));
            });
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 503;
          res.end(JSON.stringify({ message: 'Cloudflare R2 no está configurado', success: false }));
          return;
        }

        // Move endpoint: /api/images/move o /api/images-move
        if ((pathname === '/api/images/move' || pathname === '/api/images-move') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk: any) => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const fromPublicId = typeof body?.from_public_id === 'string' ? body.from_public_id.trim().replace(/^\/+/, '') : '';
              const toPublicId = typeof body?.to_public_id === 'string' ? body.to_public_id.trim().replace(/^\/+/, '') : '';

              if (!fromPublicId || !toPublicId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'Faltan parámetros from_public_id o to_public_id' }));
                return;
              }

              if (!r2Client) {
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'Cloudflare R2 no está configurado' }));
                return;
              }

              const destinationKey = toPublicId.replace(/(\.[^/.]+)?$/, (extension = '') => `_${randomUUID()}${extension}`);

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
                    Key: destinationKey,
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

              // Conservar el origen: puede estar referenciado en otras páginas.

              // También copiar la miniatura asociada si existe
              const fromThumb = matchedSourceKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
              const toThumb = destinationKey.replace(/\.[^.]+$/, '') + '_thumb.webp';
              try {
                await r2Client.send(new CopyObjectCommand({
                  Bucket: r2BucketName,
                  CopySource: `${r2BucketName}/${fromThumb}`,
                  Key: toThumb,
                }));
              } catch {
                // Miniatura previa puede no existir
              }

              const secureUrl = `${r2PublicDomain}/${destinationKey}`;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ secure_url: secureUrl, public_id: destinationKey }));
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
    fs: {
      strict: false,
      allow: ['..'],
    },
  },
});

