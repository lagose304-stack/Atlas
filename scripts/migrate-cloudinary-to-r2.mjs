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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_KEY');
  process.exit(1);
}

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_DOMAIN) {
  console.error('❌ Faltan credenciales de Cloudflare R2 en las variables de entorno.');
  process.exit(1);
}

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

  // Verificar si ya fue subida previamente para no re-descargar
  const exists = await fileExistsInR2(key);
  if (exists) {
    return { key, newUrl: targetR2Url, reused: true };
  }

  // Descargar imagen de Cloudinary
  const response = await axios.get(cloudinaryUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const contentType = response.headers['content-type'] || 'image/jpeg';

  // Subir a R2
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

async function migratePlacas() {
  console.log('\n--- 1. Migrando tabla `placas` ---');
  const { data: placas, error } = await supabase.from('placas').select('id, photo_url');
  if (error) {
    console.error('Error al consultar placas:', error.message);
    return;
  }

  const cloudinaryPlacas = (placas || []).filter((p) => isCloudinaryUrl(p.photo_url));
  console.log(`Encontradas ${cloudinaryPlacas.length} placas con URLs de Cloudinary.`);

  let migrated = 0;
  for (const placa of cloudinaryPlacas) {
    try {
      const { newUrl, reused } = await transferImageToR2(placa.photo_url);
      const { error: updateError } = await supabase
        .from('placas')
        .update({ photo_url: newUrl })
        .eq('id', placa.id);

      if (updateError) {
        console.error(`❌ Error actualizando placa ${placa.id}:`, updateError.message);
      } else {
        migrated++;
        console.log(`✅ [${migrated}/${cloudinaryPlacas.length}] Placa ${placa.id} -> ${newUrl} ${reused ? '(existente)' : '(subida)'}`);
      }
    } catch (err) {
      console.error(`⚠️ Error migrando placa ${placa.id} (${placa.photo_url}):`, err.message);
    }
  }
}

async function migratePruebasPreguntas() {
  console.log('\n--- 2. Migrando preguntas de evaluaciones (`pruebas_preguntas`) ---');
  try {
    const { data: preguntas, error } = await supabase.from('pruebas_preguntas').select('id, reference_photo_url');
    if (error) {
      console.log('Nota: tabla `pruebas_preguntas` no encontrada o sin columna reference_photo_url:', error.message);
      return;
    }

    const cldPreguntas = (preguntas || []).filter((p) => isCloudinaryUrl(p.reference_photo_url));
    console.log(`Encontradas ${cldPreguntas.length} preguntas con URLs de Cloudinary.`);

    for (const preg of cldPreguntas) {
      try {
        const { newUrl } = await transferImageToR2(preg.reference_photo_url);
        await supabase
          .from('pruebas_preguntas')
          .update({ reference_photo_url: newUrl })
          .eq('id', preg.id);
        console.log(`✅ Pregunta ${preg.id} -> ${newUrl}`);
      } catch (err) {
        console.error(`⚠️ Error migrando pregunta ${preg.id}:`, err.message);
      }
    }
  } catch (err) {
    console.log('Omitiendo pruebas_preguntas:', err.message);
  }
}

async function migrateContentBlocks() {
  console.log('\n--- 3. Migrando bloques de contenido (`content_blocks`) ---');
  try {
    const { data: blocks, error } = await supabase.from('content_blocks').select('id, block_type, content');
    if (error) {
      console.log('Nota al leer content_blocks:', error.message);
      return;
    }

    let updatedCount = 0;
    for (const block of blocks || []) {
      const strContent = JSON.stringify(block.content || {});
      if (isCloudinaryUrl(strContent)) {
        console.log(`Bloque ${block.id} (${block.block_type}) contiene imágenes de Cloudinary.`);
        const urls = strContent.match(/https:\/\/res\.cloudinary\.com\/[^\s"'\\]+/g) || [];
        let updatedStr = strContent;
        for (const cldUrl of urls) {
          try {
            const { newUrl } = await transferImageToR2(cldUrl);
            updatedStr = updatedStr.replaceAll(cldUrl, newUrl);
          } catch (err) {
            console.warn(`No se pudo transferir ${cldUrl}:`, err.message);
          }
        }

        if (updatedStr !== strContent) {
          await supabase
            .from('content_blocks')
            .update({ content: JSON.parse(updatedStr) })
            .eq('id', block.id);
          updatedCount++;
          console.log(`✅ Bloque ${block.id} actualizado.`);
        }
      }
    }
    console.log(`Bloques de contenido actualizados: ${updatedCount}`);
  } catch (err) {
    console.log('Omitiendo content_blocks:', err.message);
  }
}

async function run() {
  console.log('🚀 Iniciando migración a Cloudflare R2...');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Dominio Público: ${R2_PUBLIC_DOMAIN}`);

  await migratePlacas();
  await migratePruebasPreguntas();
  await migrateContentBlocks();

  console.log('\n🎉 ¡Migración finalizada con éxito!');
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
