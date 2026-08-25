import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

async function run() {
  let allKeys = [];
  let token = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME || 'atlas-media',
      Prefix: 'placas/sin_clasificar/',
      ContinuationToken: token
    }));
    if (res.Contents) {
      allKeys.push(...res.Contents.map(c => c.Key).filter(k => k.endsWith('.webp') || k.endsWith('.jpg') || k.endsWith('.png')));
    }
    token = res.NextContinuationToken;
  } while (token);

  console.log(`Total files in R2: ${allKeys.length}`);

  const header = `-- ==================================================================================
-- Atlas de Histología — Poblar placas_sin_clasificar con imágenes reales de R2
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Limpiar registros viejos/inexistentes de la lista de espera
TRUNCATE TABLE public.placas_sin_clasificar RESTART IDENTITY;

-- 2. Insertar las imágenes reales existentes en Cloudflare R2
INSERT INTO public.placas_sin_clasificar (photo_url, public_id) VALUES
`;

  const rows = allKeys.map(k => {
    const photoUrl = `${R2_PUBLIC_DOMAIN}/${k}`;
    const publicId = k.replace(/\.[^/.]+$/, '');
    return `  ('${photoUrl}', '${publicId}')`;
  });

  const fullSql = header + rows.join(',\n') + ';\n';

  const dest = path.resolve(__dirname, '../database/populate_placas_sin_clasificar_from_r2.sql');
  fs.writeFileSync(dest, fullSql, 'utf8');
  console.log(`Saved to ${dest}`);
}

run();
