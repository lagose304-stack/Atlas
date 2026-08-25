import fs from 'fs';
import path from 'path';

const cacheDirs = [
  'C:/Users/lagos/AppData/Local/Google/Chrome/User Data/Default/Cache/Cache_Data',
  'C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data',
  'C:/Users/lagos/AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cache/Cache_Data'
];

const outDir = 'c:/Users/lagos/OneDrive/Escritorio/Atlas/recovered_images';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let rescuedCount = 0;

for (const dir of cacheDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  
  for (const f of files) {
    // Look at individual cache files like [hash]_0, [hash]_1, [hash]_2 or f_xxxxxx
    try {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.size < 1000) continue;
      
      const buf = fs.readFileSync(fullPath);
      const str = buf.toString('latin1');
      
      // Match if this cache file contains an image identifier
      // Examples: .../placas/sin_clasificar/w52wt1u4rhzicmnr1lsu.webp
      //           .../placas/w52wt1u4rhzicmnr1lsu.jpg
      const match = str.match(/(?:placas|temas|creditos|pruebas)\/(?:sin_clasificar\/)?([a-z0-9_-]{10,})\.(webp|jpe?g|png|avif)/i);
      
      // Look for magic image bytes in this file or its companion files (_1, _2)
      let imgBuf = null;
      let targetExt = 'webp';
      
      function extractImageFromBuffer(b) {
        const webpIdx = b.indexOf(Buffer.from('RIFF'));
        if (webpIdx !== -1 && b.indexOf(Buffer.from('WEBP'), webpIdx) === webpIdx + 8) {
          return { buf: b.subarray(webpIdx), ext: 'webp' };
        }
        const jpgIdx = b.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]));
        if (jpgIdx !== -1) {
          return { buf: b.subarray(jpgIdx), ext: 'jpg' };
        }
        const pngIdx = b.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47]));
        if (pngIdx !== -1) {
          return { buf: b.subarray(pngIdx), ext: 'png' };
        }
        return null;
      }
      
      const selfImg = extractImageFromBuffer(buf);
      if (selfImg && match) {
        const id = match[1];
        const filename = `${id}.${selfImg.ext}`;
        fs.writeFileSync(path.join(outDir, filename), selfImg.buf);
        console.log(`🎯 RESCATADA: ${filename} (${(selfImg.buf.length / 1024).toFixed(1)} KB)`);
        rescuedCount++;
      } else if (match && f.endsWith('_0')) {
        // Check companion _1 or _2
        const base = f.replace(/_0$/, '');
        for (const suffix of ['_1', '_2']) {
          const compPath = path.join(dir, base + suffix);
          if (fs.existsSync(compPath)) {
            const compBuf = fs.readFileSync(compPath);
            const compImg = extractImageFromBuffer(compBuf);
            if (compImg) {
              const id = match[1];
              const filename = `${id}.${compImg.ext}`;
              fs.writeFileSync(path.join(outDir, filename), compImg.buf);
              console.log(`🎯 RESCATADA (vía companion ${suffix}): ${filename} (${(compImg.buf.length / 1024).toFixed(1)} KB)`);
              rescuedCount++;
            }
          }
        }
      }
    } catch (e) {}
  }
}

console.log(`\n======================================================`);
console.log(`🎉 TOTAL DE IMÁGENES SALVADAS DIRECTO DEL NAVEGADOR: ${rescuedCount}`);
console.log(`Carpeta destino: ${outDir}`);
console.log(`======================================================`);
