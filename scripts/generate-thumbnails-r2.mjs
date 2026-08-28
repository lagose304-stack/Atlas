import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'atlas-media';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Faltan credenciales de Cloudflare R2 en .env');
  process.exit(1);
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function listAllR2Objects() {
  const allObjects = [];
  let continuationToken = undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      allObjects.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects;
}

const THUMB_WIDTH = 480;
const THUMB_QUALITY = 78;

async function generateThumbnailForObject(key, existingKeysSet) {
  const thumbKey = key.replace(/\.[^.]+$/, '') + '_thumb.webp';

  if (existingKeysSet.has(thumbKey)) {
    return { status: 'skipped', key, thumbKey };
  }

  try {
    const getRes = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    const inputBuffer = await streamToBuffer(getRes.Body);
    const originalSizeKb = Math.round(inputBuffer.length / 1024);

    const thumbBuffer = await sharp(inputBuffer)
      .resize({
        width: THUMB_WIDTH,
        withoutEnlargement: true,
      })
      .webp({
        quality: THUMB_QUALITY,
        effort: 4,
      })
      .toBuffer();

    const thumbSizeKb = Math.round(thumbBuffer.length / 1024);

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    existingKeysSet.add(thumbKey);
    return {
      status: 'created',
      key,
      thumbKey,
      originalSizeKb,
      thumbSizeKb,
    };
  } catch (error) {
    return { status: 'error', key, error: error.message };
  }
}

async function main() {
  console.log('🚀 INICIANDO GENERACIÓN DE MINIATURAS EN CLOUDFLARE R2...');
  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`📐 Tamaño miniatura: ${THUMB_WIDTH}px max-width | Calidad: ${THUMB_QUALITY}% WebP\n`);

  console.log('🔍 Listando todos los objetos en R2...');
  const allObjects = await listAllR2Objects();
  console.log(`📊 Total de archivos encontrados en R2: ${allObjects.length}`);

  const existingKeysSet = new Set(allObjects.map((o) => o.Key));

  // Filtrar solo imágenes originales (no thumbnails existentes ni archivos no de imagen)
  const imageObjects = allObjects.filter((o) => {
    const key = o.Key || '';
    if (key.endsWith('_thumb.webp')) return false;
    return /\.(webp|jpe?g|png|bmp|tiff?)$/i.test(key);
  });

  console.log(`🖼️  Imágenes base a procesar: ${imageObjects.length}\n`);

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let totalOriginalKb = 0;
  let totalThumbKb = 0;

  // Procesar con concurrencia moderada (5 simultáneas)
  const CONCURRENCY = 5;
  for (let i = 0; i < imageObjects.length; i += CONCURRENCY) {
    const chunk = imageObjects.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((obj) => generateThumbnailForObject(obj.Key, existingKeysSet))
    );

    for (const res of results) {
      if (res.status === 'created') {
        createdCount++;
        totalOriginalKb += res.originalSizeKb;
        totalThumbKb += res.thumbSizeKb;
        console.log(
          `✅ [${createdCount + skippedCount}/${imageObjects.length}] Creado: ${res.thumbKey} (${res.originalSizeKb} KB ➔ ${res.thumbSizeKb} KB)`
        );
      } else if (res.status === 'skipped') {
        skippedCount++;
        console.log(`⏭️  [${createdCount + skippedCount}/${imageObjects.length}] Ya existe: ${res.thumbKey}`);
      } else if (res.status === 'error') {
        errorCount++;
        console.error(`❌ Error en ${res.key}: ${res.error}`);
      }
    }
  }

  console.log('\n================ RESUMEN DE GENERACIÓN ================');
  console.log(`✨ Miniaturas creadas: ${createdCount}`);
  console.log(`⏭️  Miniaturas ya existentes (omitidas): ${skippedCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  if (createdCount > 0) {
    const ahorroPorcentual = Math.round(((totalOriginalKb - totalThumbKb) / totalOriginalKb) * 100);
    console.log(`📉 Peso original total procesado: ${(totalOriginalKb / 1024).toFixed(2)} MB`);
    console.log(`📦 Peso total miniaturas creadas: ${(totalThumbKb / 1024).toFixed(2)} MB`);
    console.log(`⚡ Ahorro de transferencia en galerías: ~${ahorroPorcentual}% menos datos`);
  }
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
