import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log('🔍 INICIANDO AUDITORÍA GLOBAL DE TODAS LAS TABLAS...');

  const allUrls = [];

  // 1. Placas
  const { data: placas } = await supabase.from('placas').select('id, photo_url');
  for (const p of placas || []) {
    if (p.photo_url) allUrls.push({ source: `placas #${p.id}`, url: p.photo_url });
  }

  // 2. Temas
  const { data: temas } = await supabase.from('temas').select('id, nombre, logo_url');
  for (const t of temas || []) {
    if (t.logo_url) allUrls.push({ source: `temas #${t.id} (${t.nombre})`, url: t.logo_url });
  }

  // 3. Subtemas
  const { data: subtemas } = await supabase.from('subtemas').select('id, nombre, logo_url');
  for (const s of subtemas || []) {
    if (s.logo_url) allUrls.push({ source: `subtemas #${s.id} (${s.nombre})`, url: s.logo_url });
  }

  // 4. Content blocks
  const { data: blocks } = await supabase.from('content_blocks').select('id, entity_type, entity_id, block_type, body');
  for (const b of blocks || []) {
    const str = JSON.stringify(b.body || {});
    const matches = str.match(/https:\/\/[^"'\s\\]+/g) || [];
    for (const m of matches) {
      allUrls.push({ source: `content_blocks #${b.id} (${b.entity_type} ${b.entity_id})`, url: m });
    }
  }

  // 5. Content page versions
  const { data: versions } = await supabase.from('content_page_versions').select('id, entity_type, entity_id, version_number, blocks');
  for (const v of versions || []) {
    const str = JSON.stringify(v.blocks || {});
    const matches = str.match(/https:\/\/[^"'\s\\]+/g) || [];
    for (const m of matches) {
      allUrls.push({ source: `content_page_versions #${v.id}`, url: m });
    }
  }

  console.log(`📊 Total de URLs extraídas: ${allUrls.length}`);

  let okCount = 0;
  let failCount = 0;
  const failures = [];

  // Deduplicar para test rápido
  const uniqueMap = new Map();
  for (const item of allUrls) {
    if (!uniqueMap.has(item.url)) {
      uniqueMap.set(item.url, []);
    }
    uniqueMap.get(item.url).push(item.source);
  }

  console.log(`🌐 URLs únicas a verificar vía HTTP HEAD: ${uniqueMap.size}`);

  const entries = Array.from(uniqueMap.entries());
  
  for (let i = 0; i < entries.length; i++) {
    const [url, sources] = entries[i];
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.status === 200) {
        okCount++;
      } else {
        failCount++;
        failures.push({ url, status: res.status, sources });
      }
    } catch (err) {
      failCount++;
      failures.push({ url, status: 'ERROR: ' + err.message, sources });
    }
    if ((i + 1) % 100 === 0 || i + 1 === entries.length) {
      console.log(`Progreso: ${i + 1}/${entries.length} verificadas...`);
    }
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 20));
    }
  }

  console.log('\n=== RESULTADO FINAL DE LA AUDITORÍA GLOBAL ===');
  console.log(`✅ URLs activas con HTTP 200 OK: ${okCount}`);
  console.log(`❌ URLs con fallos: ${failCount}`);

  if (failures.length > 0) {
    console.log('\nDetalle de URLs con fallo:');
    console.log(JSON.stringify(failures, null, 2));
  } else {
    console.log('\n🎉 ¡PERFECTO! El 100% de los recursos multimedia del Atlas responden con HTTP 200 OK en Cloudflare R2.');
  }
}

main().catch(console.error);
