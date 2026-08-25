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
  'autores',
  'creditos',
  'users',
  'atlas_system_settings',
  'audit_logs'
];

async function audit() {
  console.log('==================================================');
  console.log('🔍 AUDITORÍA GLOBAL DE URLs EN SUPABASE');
  console.log('==================================================');

  let totalCloudinaryFound = 0;
  let totalR2Found = 0;

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        // tabla no existe en el esquema o no accesible
        continue;
      }

      const jsonStr = JSON.stringify(data || []);
      const cldMatches = jsonStr.match(/https:\/\/res\.cloudinary\.com\/[^\s"'\\]+/g) || [];
      const r2Matches = jsonStr.match(/https:\/\/[a-z0-9-]+\.r2\.dev\/[^\s"'\\]+/g) || [];

      totalCloudinaryFound += cldMatches.length;
      totalR2Found += r2Matches.length;

      if (cldMatches.length > 0) {
        console.log(`❌ [${table}] CONTIENE ${cldMatches.length} URLs de Cloudinary!`);
        cldMatches.slice(0, 3).forEach((u) => console.log(`   - ${u}`));
      } else {
        console.log(`✅ [${table}] 100% LIMPIO (0 Cloudinary, ${r2Matches.length} R2, ${data.length} filas)`);
      }
    } catch (e) {
      console.log(`[${table}] Omitido:`, e.message);
    }
  }

  console.log('==================================================');
  console.log(`TOTAL CLOUDINARY: ${totalCloudinaryFound}`);
  console.log(`TOTAL CLOUDFLARE R2: ${totalR2Found}`);
  console.log('==================================================');
}

audit();
