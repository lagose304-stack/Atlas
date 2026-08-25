import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'atlas-media';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

const extractCleanKeyFromCloudinary = (url) => {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const uploadIndex = pathname.indexOf('/upload/');
    if (uploadIndex === -1) return '';

    let after = pathname.slice(uploadIndex + '/upload/'.length);
    let segments = after.split('/').filter(Boolean);

    const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
    if (versionIndex >= 0) {
      segments = segments.slice(versionIndex + 1);
    } else {
      const isTransform = (s) => /^([a-z]{1,3}_[^/]+)(,[a-z]{1,3}_[^/]+)*$/.test(s);
      while (segments.length > 1 && isTransform(segments[0])) {
        segments.shift();
      }
    }

    return segments.join('/');
  } catch {
    return '';
  }
};

const fileExistsInR2 = async (key) => {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
};

const transferImageToR2 = async (cloudinaryUrl) => {
  const key = extractCleanKeyFromCloudinary(cloudinaryUrl);
  if (!key) throw new Error(`No se pudo extraer clave limpia de ${cloudinaryUrl}`);

  const targetR2Url = `${R2_PUBLIC_DOMAIN}/${key}`;

  const exists = await fileExistsInR2(key);
  if (exists) {
    return { key, newUrl: targetR2Url, reused: true };
  }

  const response = await axios.get(cloudinaryUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const contentType = response.headers['content-type'] || 'image/jpeg';

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(response.data),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { key, newUrl: targetR2Url, reused: false };
};

async function syncTableImages(tableName, urlColumns = ['photo_url']) {
  console.log(`\n--- Sincronizando imágenes de tabla: ${tableName} ---`);
  try {
    const { data: rows, error } = await supabase.from(tableName).select('*');
    if (error || !rows) {
      console.log(`Nota: no se pudo leer ${tableName}:`, error?.message);
      return;
    }

    let processed = 0;
    for (const row of rows) {
      for (const col of urlColumns) {
        const val = row[col];
        if (isCloudinaryUrl(val)) {
          try {
            const { newUrl, reused } = await transferImageToR2(val);
            processed++;
            console.log(`✅ [${tableName}] ID ${row.id} (${col}) -> ${newUrl} ${reused ? '(en R2)' : '(subida a R2)'}`);
          } catch (err) {
            console.error(`⚠️ Error transfiriendo imagen de ${tableName} ID ${row.id}:`, err.message);
          }
        }
      }
    }
    console.log(`Total imágenes procesadas para ${tableName}: ${processed}`);
  } catch (err) {
    console.error(`Error en tabla ${tableName}:`, err.message);
  }
}

async function run() {
  console.log('🚀 Iniciando subida de TODAS las imágenes de Cloudinary hacia R2...');
  
  await syncTableImages('temas', ['logo_url']);
  await syncTableImages('subtemas', ['logo_url']);
  await syncTableImages('pruebas', ['image_url']);
  await syncTableImages('placas', ['photo_url']);
  
  console.log('\n🎉 ¡Todas las imágenes han sido transferidas a Cloudflare R2!');
}

run();
