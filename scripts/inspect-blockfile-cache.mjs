import fs from 'fs';
import path from 'path';

const dirs = [
  'C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data',
  'C:/Users/lagos/AppData/Local/Google/Chrome/User Data/Default/Cache/Cache_Data',
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.startsWith('f_')).slice(0, 30);
  console.log(`\n--- Inspecting ${dir} ---`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const str = buf.toString('latin1');
    const matches = str.match(/https?:\/\/[^\s\0\r\n"\'<>]+/g);
    const hasWebp = buf.includes(Buffer.from('WEBP'));
    const hasJpg = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff])) !== -1;
    console.log(`${f} | Size: ${(buf.length / 1024).toFixed(1)} KB | Image: ${hasWebp ? 'WEBP' : (hasJpg ? 'JPG' : 'NO')} | URLs: ${matches ? matches.length : 0}`);
    if (matches) {
      console.log(`   Sample URL: ${matches[0]}`);
    }
  }
}
