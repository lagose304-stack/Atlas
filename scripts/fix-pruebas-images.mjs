import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generatePruebasFix() {
  const { data: pruebas } = await supabase.from('pruebas').select('id, nombre, tema_id, subtema_id');
  const { data: subtemas } = await supabase.from('subtemas').select('id, nombre, logo_url');
  const { data: temas } = await supabase.from('temas').select('id, nombre, logo_url');

  const subMap = new Map((subtemas || []).map((s) => [s.id, s.logo_url]));
  const temaMap = new Map((temas || []).map((t) => [t.id, t.logo_url]));

  let sqlStatements = [];
  for (const p of pruebas || []) {
    const logo = (p.subtema_id && subMap.get(p.subtema_id)) || (p.tema_id && temaMap.get(p.tema_id));
    if (logo) {
      sqlStatements.push(`UPDATE public.pruebas SET image_url = '${logo}' WHERE id = '${p.id}';`);
    }
  }

  const fullSql = `-- =====================================================================
-- Atlas de Histología — Corrección de imágenes de portada de Evaluaciones
-- Ejecuta este script en Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

${sqlStatements.join('\n')}
`;

  const sqlPath = path.resolve(__dirname, '../database/fix_pruebas_covers.sql');
  fs.writeFileSync(sqlPath, fullSql, 'utf-8');
  console.log(`✅ Script SQL de corrección de portadas generado en: database/fix_pruebas_covers.sql`);
  console.log(`Total de pruebas corregidas: ${sqlStatements.length}`);
}

generatePruebasFix();
