import fs from 'fs';
import path from 'path';

const cacheDirs = [
  'C:/Users/lagos/AppData/Local/Google/Chrome/User Data/Default/Cache/Cache_Data',
  'C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data',
  'C:/Users/lagos/AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cache/Cache_Data'
];

let urlFound = 0;
for (const dir of cacheDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    try {
      const fullPath = path.join(dir, f);
      const buf = fs.readFileSync(fullPath);
      const str = buf.toString('latin1');
      const regex = /https?:\/\/[^\s\0\r\n"\'<>]{10,}/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const u = match[0];
        if (u.includes('r2.dev') || u.includes('cloudinary') || u.includes('.webp') || u.includes('placas')) {
          console.log(`Found URL in ${f}: ${u}`);
          urlFound++;
        }
      }
    } catch (e) {}
  }
}
console.log(`Total key URLs found in cache streams: ${urlFound}`);
