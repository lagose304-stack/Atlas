import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'atlas-media';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const recoveredDir = path.resolve(__dirname, '../recovered_images');
if (!fs.existsSync(recoveredDir)) fs.mkdirSync(recoveredDir, { recursive: true });

function extractImage(buffer) {
  if (!buffer || buffer.length < 50) return null;
  const webpIdx = buffer.indexOf(Buffer.from('RIFF'));
  if (webpIdx !== -1 && buffer.indexOf(Buffer.from('WEBP'), webpIdx) === webpIdx + 8) {
    return { data: buffer.subarray(webpIdx), contentType: 'image/webp', ext: 'webp' };
  }
  const jpgIdx = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (jpgIdx !== -1) {
    return { data: buffer.subarray(jpgIdx), contentType: 'image/jpeg', ext: 'jpg' };
  }
  const pngIdx = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (pngIdx !== -1) {
    return { data: buffer.subarray(pngIdx), contentType: 'image/png', ext: 'png' };
  }
  return null;
}

function parseChromiumAddr(cacheDir, addr, dataSize) {
  if (!addr || addr === 0) return null;
  const isSeparate = (addr & 0x40000000) !== 0;
  if (isSeparate) {
    const fileNum = addr & 0x0fffffff;
    const fileName = 'f_' + fileNum.toString(16).padStart(6, '0');
    const filePath = path.join(cacheDir, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  }
  const fileType = (addr >> 28) & 0x7;
  const blockNumber = addr & 0x00ffffff;
  const dataFile = path.join(cacheDir, `data_${fileType}`);
  if (fs.existsSync(dataFile)) {
    const blockSizes = [0, 36, 256, 1024, 4096];
    const blockSize = blockSizes[fileType] || 256;
    const offset = 8192 + blockNumber * blockSize;
    const fd = fs.openSync(dataFile, 'r');
    const buf = Buffer.alloc(Math.max(blockSize, dataSize || blockSize));
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    return buf;
  }
  return null;
}

function scanCacheDir(cacheDir) {
  const data1Path = path.join(cacheDir, 'data_1');
  if (!fs.existsSync(data1Path)) return [];
  const data1 = fs.readFileSync(data1Path);

  const results = [];
  // Scan for Entry records (size 256 or 36)
  for (let offset = 8192; offset < data1.length - 256; offset += 256) {
    const entryBuf = data1.subarray(offset, offset + 256);
    const keyLen = entryBuf.readInt32LE(28); // key_len at offset 28 or near
    
    // Check if key is inline at offset 96 (standard EntryStore layout)
    // EntryStore:
    // 0: hash (4)
    // 4: next (4)
    // 8: rankings_node (4)
    // 12: reuse_count (4)
    // 16: refetch_count (4)
    // 20: state (4)
    // 24: creation_time (8)
    // 32: key_len (4)
    // 36: key_addr (4)
    // 40: data_size[4] (16)
    // 56: data_addr[4] (16)
    // 72: flags (4)
    // 76: pad[4] (16)
    // 92: self_hash (4)
    // 96: inline key string...
    
    let key = '';
    const keySlice = entryBuf.subarray(96, 96 + 150).toString('latin1');
    const match = keySlice.match(/^(https?:\/\/[^\s\0\r\n"\'<>]+)/);
    if (match) {
      key = match[1];
    } else {
      // Check if key starts at other offsets
      const fullSlice = entryBuf.toString('latin1');
      const anyMatch = fullSlice.match(/https?:\/\/[^\s\0\r\n"\'<>]+/);
      if (anyMatch) key = anyMatch[0];
    }

    if (key && (key.includes('r2.dev') || key.includes('cloudinary.com') || key.includes('placas'))) {
      const dataSize1 = entryBuf.readInt32LE(44);
      const dataAddr1 = entryBuf.readUInt32LE(60);
      
      let payload = parseChromiumAddr(cacheDir, dataAddr1, dataSize1);
      let img = extractImage(payload);
      
      // If stream 1 didn't have it, check stream 0 or stream 2
      if (!img) {
        const dataAddr0 = entryBuf.readUInt32LE(56);
        const dataSize0 = entryBuf.readInt32LE(40);
        payload = parseChromiumAddr(cacheDir, dataAddr0, dataSize0);
        img = extractImage(payload);
      }

      if (img) {
        results.push({ url: key, image: img });
      }
    }
  }
  return results;
}

async function run() {
  console.log('====================================================');
  console.log('🚀 RESTAURACIÓN AUTOMÁTICA DE PLACAS DESDE CACHÉ A R2');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log('====================================================\n');

  const cacheDirs = [
    'C:/Users/lagos/AppData/Local/Google/Chrome/User Data/Default/Cache/Cache_Data',
    'C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data',
    'C:/Users/lagos/AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cache/Cache_Data',
  ];

  const allItems = new Map();

  for (const dir of cacheDirs) {
    if (!fs.existsSync(dir)) continue;
    const found = scanCacheDir(dir);
    console.log(`Directorio: ${dir} -> Encontradas ${found.length} imágenes con URL directa.`);
    for (const item of found) {
      let r2Key = null;
      if (item.url.includes('r2.dev/')) {
        r2Key = item.url.split('r2.dev/')[1].split('?')[0];
      } else if (item.url.includes('cloudinary.com/')) {
        const parts = item.url.split('/upload/');
        if (parts[1]) {
          let afterUpload = parts[1].replace(/^(?:[a-z0-9_:,]+|\bv\d+\b)\//gi, '').split('?')[0];
          while (afterUpload.startsWith('c_') || afterUpload.startsWith('w_') || afterUpload.startsWith('q_') || afterUpload.startsWith('v')) {
            afterUpload = afterUpload.replace(/^[^/]+\//, '');
          }
          if (!afterUpload.startsWith('placas/') && !afterUpload.startsWith('temas/') && !afterUpload.startsWith('creditos/')) {
            afterUpload = `placas/sin_clasificar/${afterUpload}`;
          }
          r2Key = afterUpload;
        }
      }

      if (r2Key) {
        allItems.set(r2Key, { r2Key, data: item.image.data, contentType: item.image.contentType, ext: item.image.ext });
      }
    }
  }

  console.log(`\n📦 Total de placas listas con sus nombres y rutas exactas para R2: ${allItems.size}\n`);

  let uploaded = 0;
  for (const [key, item] of allItems.entries()) {
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: item.r2Key,
          Body: item.data,
          ContentType: item.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      uploaded++;
      console.log(`✅ [${uploaded}/${allItems.size}] Subida a R2: ${item.r2Key} (${(item.data.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.error(`❌ Error al subir ${item.r2Key}:`, e.message);
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 ¡ÉXITO! Se restauraron y subieron ${uploaded} placas a Cloudflare R2.`);
  console.log('====================================================');
}

run().catch(console.error);
