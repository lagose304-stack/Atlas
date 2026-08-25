import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
  'placas',
  'temas',
  'subtemas',
  'content_blocks',
  'content_page_drafts',
  'content_page_versions',
  'pruebas',
  'preguntas',
  'pruebas_preguntas',
  'autores',
  'creditos',
  'users',
  'atlas_system_settings'
];

async function runAudit() {
  console.log('====================================================');
  console.log('🔍 AUDITORÍA DETALLADA DE TODAS LAS TABLAS Y URLs');
  console.log('====================================================');

  let totalWebp = 0;
  let totalNonWebp = 0;
  let totalCloudinary = 0;

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        // tabla no existe en el esquema
        continue;
      }
      if (!data) continue;

      const str = JSON.stringify(data);
      const webpMatches = str.match(/https:\/\/[a-z0-9-]+\.r2\.dev\/[^\s"'\\]+\.webp/gi) || [];
      const nonWebpMatches = str.match(/https:\/\/[a-z0-9-]+\.r2\.dev\/[^\s"'\\]+\.(jpe?g|png|bmp|gif)/gi) || [];
      const cldMatches = str.match(/res\.cloudinary\.com/gi) || [];

      totalWebp += webpMatches.length;
      totalNonWebp += nonWebpMatches.length;
      totalCloudinary += cldMatches.length;

      console.log(
        `Tabla [${table}] (${data.length} filas): ${webpMatches.length} WebP en R2, ${nonWebpMatches.length} No-WebP, ${cldMatches.length} Cloudinary`
      );

      if (nonWebpMatches.length > 0) {
        console.log(`   ⚠️ Muestras No-WebP en ${table}:`, nonWebpMatches.slice(0, 3));
      }
    } catch (e) {
      console.log(`Error en ${table}:`, e.message);
    }
  }

  console.log('====================================================');
  console.log(`TOTAL GENERAL WEBP EN R2: ${totalWebp}`);
  console.log(`TOTAL GENERAL NO-WEBP: ${totalNonWebp}`);
  console.log(`TOTAL GENERAL CLOUDINARY: ${totalCloudinary}`);
  console.log('====================================================');
}

runAudit();
