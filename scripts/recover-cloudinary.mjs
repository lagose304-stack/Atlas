import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Intenta cargar un archivo .env.cloudinary específico para este rescate
dotenv.config({ path: path.resolve(__dirname, '../.env.cloudinary') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('❌ FALTAN CREDENCIALES DE CLOUDINARY.');
  console.error('Por favor, crea un archivo llamado .env.cloudinary en la raíz del proyecto Atlas con lo siguiente:');
  console.error('CLOUDINARY_CLOUD_NAME=tu_cloud_name');
  console.error('CLOUDINARY_API_KEY=tu_api_key');
  console.error('CLOUDINARY_API_SECRET=tu_api_secret');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function recoverImages() {
  console.log('🚀 INICIANDO RESCATE DE IMÁGENES DESDE CLOUDINARY...');
  
  // 1. Obtener todas las placas que apuntan a sin_clasificar
  const { data: placas, error } = await supabase
    .from('placas')
    .select('id, photo_url')
    .ilike('photo_url', '%/sin_clasificar/%');

  if (error) {
    console.error('Error al obtener placas de Supabase:', error);
    return;
  }

  console.log(`🔍 Se encontraron ${placas.length} placas afectadas en la base de datos.`);

  const publicIds = [];
  for (const placa of placas) {
    if (placa.photo_url) {
      // Extraemos el nombre del archivo sin la extensión (ej. a1kfrn2yusatvvb21hf7)
      const filename = placa.photo_url.split('/').pop();
      const publicId = filename.replace(/\.[^/.]+$/, "");
      
      // En Cloudinary, usualmente se guardaban en la carpeta placas/ o placas/sin_clasificar/
      // Intentaremos restaurar ambas rutas
      publicIds.push(publicId);
      publicIds.push(`placas/${publicId}`);
      publicIds.push(`placas/sin_clasificar/${publicId}`);
    }
  }

  console.log(`🚑 Intentando restaurar ${publicIds.length} posibles identificadores desde los backups de Cloudinary...`);

  // Cloudinary permite restaurar en lotes de hasta 100
  const chunk = 50;
  let exitos = 0;
  
  for (let i = 0; i < publicIds.length; i += chunk) {
    const lote = publicIds.slice(i, i + chunk);
    try {
      const response = await cloudinary.api.restore(lote);
      
      // La respuesta indica qué archivos se restauraron exitosamente
      if (response && response.restored) {
        const restoredKeys = Object.keys(response.restored);
        for (const key of restoredKeys) {
            console.log(`✅ RESTAURADA: ${key}`);
            exitos++;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Error procesando un lote (posiblemente ninguno de estos IDs estaba en el backup):`, e.message || e.error);
    }
  }

  console.log('\n======================================================');
  console.log(`🎉 PROCESO DE RESCATE FINALIZADO.`);
  console.log(`Imágenes restauradas exitosamente: ${exitos}`);
  console.log('======================================================');
  
  if (exitos === 0) {
    console.log('❌ No se pudo restaurar ninguna imagen. Es posible que el Backup no estuviera activado en Cloudinary, o los IDs no coinciden.');
  } else {
    console.log('✅ ¡Las imágenes ahora deberían estar de vuelta en Cloudinary! A continuación, tendríamos que volver a pasarlas a R2.');
  }
}

recoverImages();
