import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
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

const BUCKET = process.env.R2_BUCKET_NAME || 'atlas-media';

async function main() {
  console.log('🚀 POBLANDO FÍSICAMENTE LAS IMÁGENES DE PRUEBAS EN CLOUDFLARE R2...\n');

  // Obtener todas las pruebas y sus subtemas
  const { data: pruebas, error } = await supabase
    .from('pruebas')
    .select('id, nombre, image_url, subtema_id, tema_id, subtemas:subtema_id(id, nombre, logo_url), temas:tema_id(id, nombre, logo_url)');

  if (error) {
    console.error('Error cargando pruebas:', error);
    return;
  }

  console.log(`Analizando ${pruebas.length} pruebas...`);

  let copied = 0;

  for (const p of pruebas) {
    if (!p.image_url) continue;

    // Extraer destino en R2 (ej: "pruebas/rbnnfshokj6pfhqpjb2c.webp")
    const destKey = p.image_url.replace(/^https?:\/\/[^/]+\//, '');

    // Buscar clave de origen (logo del subtema o tema)
    const sourceUrl = p.subtemas?.logo_url || p.temas?.logo_url;
    if (!sourceUrl) {
      console.warn(`⚠️ No hay logo fuente para ${p.nombre}`);
      continue;
    }

    const sourceKey = sourceUrl.replace(/^https?:\/\/[^/]+\//, '');

    try {
      // Copiar objeto en Cloudflare R2
      await r2.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${sourceKey}`,
          Key: destKey,
          ContentType: 'image/webp',
          MetadataDirective: 'COPY',
        })
      );

      console.log(`✅ [${p.nombre}] → R2 poblado: ${destKey} (copiado desde ${sourceKey})`);
      copied++;
    } catch (err) {
      console.error(`❌ Error copiando ${destKey} desde ${sourceKey}:`, err.message);
    }
  }

  console.log(`\n🎉 ¡COMPLETADO! ${copied}/${pruebas.length} imágenes de pruebas creadas físicamente en Cloudflare R2.`);
}

main().catch(console.error);
