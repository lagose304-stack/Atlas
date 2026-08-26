import fs from 'fs';
import path from 'path';

const dir = 'C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data';

function parseBlockfileDir(cacheDir) {
  const data1Path = path.join(cacheDir, 'data_1');
  if (!fs.existsSync(data1Path)) return [];
  const data1 = fs.readFileSync(data1Path);

  // Scan through data_1 looking for HTTP URLs
  const entries = [];
  let offset = 0;
  while (offset < data1.length - 100) {
    // Check if there is an http URL at or near offset
    const slice = data1.subarray(offset, offset + 500);
    const str = slice.toString('latin1');
    const match = str.match(/^(https?:\/\/[^\s\0\r\n"\'<>]+)/);
    if (match) {
      const url = match[1];
      if (url.includes('r2.dev') || url.includes('cloudinary.com') || url.includes('placas')) {
        // Read the entry structure right around this key
        entries.push({ offset, url });
      }
      offset += Math.max(32, url.length);
    } else {
      offset += 4;
    }
  }
  return entries;
}

const edgeEntries = parseBlockfileDir('C:/Users/lagos/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data');
console.log('Found Edge entries with URLs:', edgeEntries.length);
edgeEntries.slice(0, 15).forEach(e => console.log(` - ${e.url}`));

const chromeEntries = parseBlockfileDir('C:/Users/lagos/AppData/Local/Google/Chrome/User Data/Default/Cache/Cache_Data');
console.log('\nFound Chrome entries with URLs:', chromeEntries.length);
chromeEntries.slice(0, 15).forEach(e => console.log(` - ${e.url}`));
