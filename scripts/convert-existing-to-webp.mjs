import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'atlas-media';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

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

async function processSingleImage(oldKey) {
  const newKey = oldKey.replace(/\.(jpe?g|png|bmp|tiff?)$/i, '.webp');

  const getRes = await r2.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: oldKey,
    })
  );

  const inputBuffer = await streamToBuffer(getRes.Body);
  const originalSize = inputBuffer.length;

  const webpBuffer = await sharp(inputBuffer)
    .webp({
      quality: 94,
      effort: 5,
      chromaSubsampling: '4:4:4',
      smartSubsample: true,
    })
    .toBuffer();

  const newSize = webpBuffer.length;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: newKey,
      Body: webpBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: oldKey,
    })
  );

  return { originalSize, newSize, oldKey, newKey };
}

async function convertAllImagesToWebP() {
  console.log('====================================================');
  console.log('🔬 CONVERSIÓN UNIVERSAL A WEBP DE MÁXIMA CALIDAD');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log('====================================================\n');

  console.log('1. Listando todos los objetos en Cloudflare R2...');
  const objects = await listAllR2Objects();
  console.log(`Total de objetos encontrados en R2: ${objects.length}`);

  const nonWebpObjects = objects.filter((obj) =>
    /\.(jpe?g|png|bmp|tiff?)$/i.test(obj.Key || '')
  );

  console.log(`Objetos que necesitan conversión a WebP: ${nonWebpObjects.length}\n`);

  let convertedCount = 0;
  let totalBytesSaved = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < nonWebpObjects.length; i += CONCURRENCY) {
    const chunk = nonWebpObjects.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((obj) => processSingleImage(obj.Key))
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        const { originalSize, newSize, oldKey, newKey } = res.value;
        convertedCount++;
        totalBytesSaved += Math.max(0, originalSize - newSize);
        const pct = Math.round((convertedCount / nonWebpObjects.length) * 100);
        const savedPct = Math.round(((originalSize - newSize) / originalSize) * 100);
        console.log(
          `✅ [${convertedCount}/${nonWebpObjects.length}] (${pct}%) ${oldKey} -> ${newKey} ` +
          `[${(originalSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB, -${savedPct}%]`
        );
      } else {
        console.error(`❌ Error en lote:`, res.reason?.message);
      }
    }
  }

  const savedMb = (totalBytesSaved / (1024 * 1024)).toFixed(2);
  console.log('\n====================================================');
  console.log(`🎉 ¡Conversión a WebP finalizada!`);
  console.log(`Imágenes convertidas: ${convertedCount}`);
  console.log(`Espacio total optimizado: ${savedMb} MB`);
  console.log('====================================================\n');

  // Generar script SQL para actualizar Supabase
  const sqlContent = `-- ==================================================================================
-- Atlas de Histología — Estandarización de URLs a formato .webp
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Actualizar tabla PLACAS
UPDATE public.placas
SET photo_url = regexp_replace(photo_url, '\\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE photo_url ~* '\\.(jpe?g|png|bmp|tiff?)$';

-- 2. Actualizar tabla TEMAS
UPDATE public.temas
SET logo_url = regexp_replace(logo_url, '\\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE logo_url ~* '\\.(jpe?g|png|bmp|tiff?)$';

-- 3. Actualizar tabla SUBTEMAS
UPDATE public.subtemas
SET logo_url = regexp_replace(logo_url, '\\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE logo_url ~* '\\.(jpe?g|png|bmp|tiff?)$';

-- 4. Actualizar tabla PRUEBAS
UPDATE public.pruebas
SET image_url = regexp_replace(image_url, '\\.(jpe?g|png|bmp|tiff?)$', '.webp', 'i')
WHERE image_url ~* '\\.(jpe?g|png|bmp|tiff?)$';

-- 5. Actualizar bloques de contenido (content_blocks)
UPDATE public.content_blocks
SET content = regexp_replace(content::text, '\\.(jpe?g|png|bmp|tiff?)(["\\'']|$)', '.webp\\2', 'gi')::jsonb
WHERE content::text ~* '\\.(jpe?g|png|bmp|tiff?)(["\\'']|$)';

-- 6. Actualizar versiones de páginas (content_page_versions) si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_page_versions' AND column_name = 'blocks'
  ) THEN
    UPDATE public.content_page_versions
    SET blocks = regexp_replace(blocks::text, '\\.(jpe?g|png|bmp|tiff?)(["\\'']|$)', '.webp\\2', 'gi')::jsonb
    WHERE blocks::text ~* '\\.(jpe?g|png|bmp|tiff?)(["\\'']|$)';
  END IF;
END $$;
`;

  const sqlPath = path.resolve(__dirname, '../database/convert_all_urls_to_webp.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
  console.log(`📄 Script SQL generado en: database/convert_all_urls_to_webp.sql`);
}

convertAllImagesToWebP();
