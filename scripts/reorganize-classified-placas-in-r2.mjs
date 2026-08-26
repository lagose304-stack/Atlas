import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'atlas-media';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Faltan credenciales de Cloudflare R2 en .env');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ Falta VITE_SUPABASE_URL en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const slugify = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const extractKeyFromUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  } catch {
    return url.replace(/^\/+/, '');
  }
};

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 INICIANDO REORGANIZACIÓN DE PLACAS CLASIFICADAS EN R2...');

  // 1. Cargar temas y subtemas
  const { data: temas, error: temasErr } = await supabase.from('temas').select('id, nombre');
  if (temasErr) throw temasErr;

  const { data: subtemas, error: subtemasErr } = await supabase.from('subtemas').select('id, nombre, tema_id');
  if (subtemasErr) throw subtemasErr;

  const temaMap = new Map(temas.map(t => [t.id, t.nombre]));
  const subtemaMap = new Map(subtemas.map(s => [s.id, s.nombre]));

  // 2. Consultar placas clasificadas
  const { data: placas, error: placasErr } = await supabase.from('placas').select('id, photo_url, tema_id, subtema_id');
  if (placasErr) throw placasErr;

  console.log(`📋 Total de placas en BD: ${placas.length}`);

  let movedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const placa of placas) {
    const temaNombre = temaMap.get(placa.tema_id) || 'sin_tema';
    const subtemaNombre = subtemaMap.get(placa.subtema_id) || 'sin_subtema';

    const fromKey = extractKeyFromUrl(placa.photo_url);
    const filename = fromKey.split('/').pop() || `placa_${placa.id}.webp`;
    const toKey = `placas/${slugify(temaNombre)}/${slugify(subtemaNombre)}/${filename}`;

    if (fromKey === toKey) {
      skippedCount++;
      continue;
    }

    // Comprobar si la placa aún está en sin_clasificar o necesita ser reubicada
    const candidates = [
      fromKey,
      fromKey.replace(/^placas_sin_clasificar\//, 'placas/sin_clasificar/'),
      fromKey.replace(/^placas\/sin_clasificar\//, 'placas_sin_clasificar/'),
      fromKey.endsWith('.webp') ? fromKey.replace(/\.webp$/, '') : `${fromKey}.webp`,
    ];
    const uniqueCandidates = Array.from(new Set(candidates));

    let matchedSource = null;
    for (const c of uniqueCandidates) {
      if (await objectExists(c)) {
        matchedSource = c;
        break;
      }
    }

    if (!matchedSource) {
      console.warn(`⚠️ Placa #${placa.id}: No se encontró el archivo origen '${fromKey}' en R2.`);
      errorCount++;
      continue;
    }

    try {
      if (matchedSource !== toKey) {
        await r2.send(new CopyObjectCommand({
          Bucket: R2_BUCKET_NAME,
          CopySource: `${R2_BUCKET_NAME}/${matchedSource}`,
          Key: toKey,
        }));

        await r2.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: matchedSource,
        }));
      }

      const nextUrl = `${R2_PUBLIC_DOMAIN}/${toKey}`;
      if (placa.photo_url !== nextUrl) {
        await supabase.from('placas').update({ photo_url: nextUrl }).eq('id', placa.id);
      }

      console.log(`✅ Placa #${placa.id} movida: ${matchedSource} -> ${toKey}`);
      movedCount++;
    } catch (err) {
      console.error(`❌ Error al mover placa #${placa.id}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n=== RESUMEN DE REORGANIZACIÓN ===');
  console.log(`✅ Placas reubicadas en R2 y actualizadas en BD: ${movedCount}`);
  console.log(`⏩ Placas que ya estaban en su carpeta correcta: ${skippedCount}`);
  console.log(`❌ Errores o archivos no encontrados: ${errorCount}`);
}

main().catch(err => {
  console.error('Error fatal en el script:', err);
  process.exit(1);
});
