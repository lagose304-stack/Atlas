import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
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
  // 1. Fetch all classified plates from Supabase
  const { data: classifiedPlacas, error } = await supabase.from('placas').select('id, photo_url');
  if (error) {
    console.error('Error fetching placas:', error);
    return;
  }
  console.log(`Total placas clasificadas en BD: ${classifiedPlacas.length}`);

  // Normalize filenames of classified placas
  const classifiedFilenames = new Set();
  for (const p of classifiedPlacas) {
    if (p.photo_url) {
      const fn = p.photo_url.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
      classifiedFilenames.add(fn);
    }
  }
  console.log(`Nombres/IDs únicos ya clasificados: ${classifiedFilenames.size}`);

  // 2. Fetch all R2 sin_clasificar objects
  let allR2Keys = [];
  let token = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME || 'atlas-media',
      Prefix: 'placas/sin_clasificar/',
      ContinuationToken: token
    }));
    if (res.Contents) {
      allR2Keys.push(...res.Contents.map(c => c.Key).filter(k => k.endsWith('.webp') || k.endsWith('.jpg') || k.endsWith('.png')));
    }
    token = res.NextContinuationToken;
  } while (token);

  console.log(`Total objetos en R2 sin_clasificar: ${allR2Keys.length}`);

  // 3. Filter out those that are ALREADY classified
  const duplicates = [];
  const trulyPending = [];

  for (const key of allR2Keys) {
    const fn = key.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
    if (classifiedFilenames.has(fn)) {
      duplicates.push(key);
    } else {
      trulyPending.push(key);
    }
  }

  console.log('\n📊 RESULTADO DE LA COMPARACIÓN:');
  console.log(`  -> Ya están clasificadas (duplicadas): ${duplicates.length}`);
  console.log(`  -> Verdaderamente pendientes (sin clasificar): ${trulyPending.length}`);

  if (trulyPending.length > 0) {
    console.log('\nPrimeras 10 verdaderamente pendientes:');
    console.log(trulyPending.slice(0, 10));
  }

  // 4. Generate clean SQL script
  const header = `-- ==================================================================================
-- Atlas de Histología — Lista de Espera Depurada (Sin Duplicados)
-- Se eliminaron ${duplicates.length} placas que ya están clasificadas en el temario.
-- Total de placas pendientes reales: ${trulyPending.length}
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ==================================================================================

-- 1. Limpiar lista de espera
TRUNCATE TABLE public.placas_sin_clasificar RESTART IDENTITY;

`;

  let sqlBody = '';
  if (trulyPending.length > 0) {
    const rows = trulyPending.map(k => {
      const photoUrl = `${R2_PUBLIC_DOMAIN}/${k}`;
      const publicId = k.replace(/\.[^/.]+$/, '');
      return `  ('${photoUrl}', '${publicId}')`;
    });
    sqlBody = `-- 2. Insertar solo las placas verdaderamente pendientes
INSERT INTO public.placas_sin_clasificar (photo_url, public_id) VALUES
` + rows.join(',\n') + ';\n';
  } else {
    sqlBody = '-- No hay placas pendientes (todas las 502 ya fueron clasificadas previamente en el temario).\n';
  }

  const outPath = path.resolve(__dirname, '../database/populate_placas_sin_clasificar_from_r2.sql');
  fs.writeFileSync(outPath, header + sqlBody, 'utf8');
  console.log(`\nUpdated SQL file at: ${outPath}`);
}

run();
