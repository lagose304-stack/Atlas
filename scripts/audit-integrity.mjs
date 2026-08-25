import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log('⚡ AUDITORÍA DE CONSISTENCIA SUPABASE ↔ CLOUDFLARE R2 BUCKET\n');

  // 1. Obtener todos los objetos físicos en R2
  console.log('1. Listando todos los archivos físicos en Cloudflare R2...');
  let token = undefined;
  const r2Objects = new Map();
  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME || 'atlas-media',
        ContinuationToken: token,
      })
    );
    if (res.Contents) {
      for (const item of res.Contents) {
        r2Objects.set(item.Key, item.Size);
      }
    }
    token = res.NextContinuationToken;
  } while (token);

  console.log(`   📦 Archivos encontrados en Cloudflare R2: ${r2Objects.size}`);

  // 2. Extraer todas las URLs referenciadas en Supabase
  console.log('\n2. Extrayendo todas las referencias en Supabase...');
  const supabaseRefs = [];

  const { data: placas } = await supabase.from('placas').select('id, photo_url');
  for (const p of placas || []) {
    if (p.photo_url) supabaseRefs.push({ table: 'placas', id: p.id, url: p.photo_url });
  }

  const { data: temas } = await supabase.from('temas').select('id, nombre, logo_url');
  for (const t of temas || []) {
    if (t.logo_url) supabaseRefs.push({ table: 'temas', id: `${t.id} (${t.nombre})`, url: t.logo_url });
  }

  const { data: subtemas } = await supabase.from('subtemas').select('id, nombre, logo_url');
  for (const s of subtemas || []) {
    if (s.logo_url) supabaseRefs.push({ table: 'subtemas', id: `${s.id} (${s.nombre})`, url: s.logo_url });
  }

  const { data: pruebas } = await supabase.from('pruebas').select('id, nombre, image_url');
  for (const pr of pruebas || []) {
    if (pr.image_url) supabaseRefs.push({ table: 'pruebas', id: `${pr.id} (${pr.nombre})`, url: pr.image_url });
  }

  const { data: blocks } = await supabase.from('content_blocks').select('id, entity_type, entity_id, block_type, body');
  for (const b of blocks || []) {
    const str = JSON.stringify(b.body || {});
    const matches = str.match(/https:\/\/[^"'\s\\]+/g) || [];
    for (const m of matches) {
      supabaseRefs.push({ table: 'content_blocks', id: `${b.id} (${b.entity_type} #${b.entity_id})`, url: m });
    }
  }

  console.log(`   📑 Total de referencias en base de datos: ${supabaseRefs.length}`);

  // 3. Cruzar cada referencia contra el bucket físico
  console.log('\n3. Verificando cada referencia contra el almacenamiento físico...');

  let validCount = 0;
  let missingInR2 = [];
  let nonR2Urls = [];

  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

  for (const ref of supabaseRefs) {
    if (!ref.url.startsWith(publicDomain) && !ref.url.includes('r2.dev')) {
      nonR2Urls.push(ref);
      continue;
    }

    // Extraer la clave en R2
    const key = ref.url.replace(/^https?:\/\/[^/]+\//, '');
    if (r2Objects.has(key)) {
      validCount++;
    } else {
      missingInR2.push({ ...ref, key });
    }
  }

  console.log('\n======================================================');
  console.log(`✅ Referencias 100% verificadas en Cloudflare R2: ${validCount}`);
  console.log(`⚠️ Referencias a dominios externos/antiguos: ${nonR2Urls.length}`);
  console.log(`❌ Referencias huérfanas (en BD pero no en R2): ${missingInR2.length}`);
  console.log('======================================================');

  if (nonR2Urls.length > 0) {
    console.log('\nDetalle de URLs no-R2:');
    console.log(nonR2Urls);
  }

  if (missingInR2.length > 0) {
    console.log('\nDetalle de referencias huérfanas:');
    console.log(missingInR2);
  }

  if (missingInR2.length === 0 && nonR2Urls.length === 0) {
    console.log('\n✨ ¡INTEGRIDAD TOTAL! Todas las imágenes de placas, temas, subtemas y pruebas existen físicamente en Cloudflare R2.');
  }
}

main().catch(console.error);
