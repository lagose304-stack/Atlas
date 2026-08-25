import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('🚀 SINCRONIZANDO IMÁGENES DE PRUEBAS CON SUS SUBTEMAS CORRESPONDIENTES...\n');

  // Obtener todas las pruebas con sus subtemas
  const { data: pruebas, error } = await supabase
    .from('pruebas')
    .select('id, nombre, image_url, subtema_id, tema_id, subtemas:subtema_id(id, nombre, logo_url), temas:tema_id(id, nombre, logo_url)');

  if (error) {
    console.error('Error cargando pruebas:', error);
    return;
  }

  console.log(`Analizando ${pruebas.length} pruebas...`);

  let updated = 0;

  for (const p of pruebas) {
    const subtemaLogo = p.subtemas?.logo_url;
    const temaLogo = p.temas?.logo_url;
    const fallbackLogo = subtemaLogo || temaLogo;

    if (fallbackLogo) {
      const { error: updateError } = await supabase
        .from('pruebas')
        .update({ image_url: fallbackLogo })
        .eq('id', p.id);

      if (updateError) {
        console.error(`❌ Error actualizando prueba ${p.nombre}:`, updateError);
      } else {
        console.log(`✅ [${p.nombre}] → Imagen actualizada a: ${fallbackLogo}`);
        updated++;
      }
    } else {
      console.warn(`⚠️ Prueba ${p.nombre} no tiene subtema ni tema con logo`);
    }
  }

  console.log(`\n🎉 ¡Actualización completada! ${updated}/${pruebas.length} pruebas actualizadas con imágenes válidas.`);
}

main().catch(console.error);
