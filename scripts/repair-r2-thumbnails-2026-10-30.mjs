// Mantenimiento acotado. Sin argumento prepara archivos; --apply-thumbnails crea
// únicamente miniaturas ausentes. Nunca modifica originales ni la base de datos.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'backend/package.json'));
const dotenv = require('dotenv');
const sharp = require('sharp');
const { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const planPath = path.join(root, 'docs/revisiones/r2-miniaturas-y-referencias-2026-10-30.json');
const output = path.join(root, 'recovered_images/r2-thumbnails-2026-10-30');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function run() {
  assert(process.argv.slice(2).every(arg => arg === '--apply-thumbnails'), 'Argumento no permitido');
  const apply = process.argv.includes('--apply-thumbnails');
  const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
  assert(plan.thumbnails.length === 9, 'El alcance no coincide con las nueve miniaturas revisadas');
  const env = { ...dotenv.parse(await fs.readFile(path.join(root, 'backend/.env'))), ...process.env };
  for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) {
    assert(Boolean(env[key]), `Falta ${key}`);
  }
  const client = new S3Client({
    region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    maxAttempts: 2,
  });
  const Bucket = env.R2_BUCKET_NAME;
  const head = async Key => {
    try { return await client.send(new HeadObjectCommand({ Bucket, Key })); }
    catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
  };
  await fs.mkdir(output, { recursive: true });
  const manifestPath = path.join(output, 'manifest.json');
  let manifest;
  if (!apply) {
    // Una referencia se retira solo si su destino R2 continúa sin existir.
    const missingKeys = [...new Set(plan.missing_references.map(item => item.resolved_key))];
    for (const key of missingKeys) assert(!await head(key), 'Un archivo marcado como irrecuperable ahora existe; revisar el plan');
    manifest = { status: 'prepared', originalsModified: false, referencesCheckedMissing: missingKeys.length, items: [] };
    for (const item of plan.thumbnails) {
      assert(item.thumbnail_key === item.original_key.replace(/\.[^.]+$/, '') + '_thumb.webp', 'Destino inesperado');
      assert(!await head(item.thumbnail_key), 'Una miniatura ya existe; revisar antes de continuar');
      const original = await client.send(new GetObjectCommand({ Bucket, Key: item.original_key }));
      const bytes = Buffer.from(await original.Body.transformToByteArray());
      const generated = await sharp(bytes).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
      const metadata = await sharp(generated).metadata();
      assert(metadata.format === 'webp' && metadata.width > 0 && metadata.width <= 480, 'Miniatura inválida');
      const filename = `${item.table}-${item.id}_thumb.webp`;
      await fs.writeFile(path.join(output, filename), generated);
      await fs.writeFile(path.join(output, `${item.table}-${item.id}_original.webp`), bytes);
      manifest.items.push({ ...item, filename, originalETag: original.ETag, originalSha256: sha(bytes), sha256: sha(generated), bytes: generated.length, width: metadata.width, height: metadata.height, created: false });
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  } else {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assert(manifest.items.length === 9, 'Primero hay que preparar las nueve miniaturas');
    for (const item of manifest.items) {
      const approved = plan.thumbnails.find(row => row.original_key === item.original_key && row.thumbnail_key === item.thumbnail_key);
      assert(approved, 'Objeto fuera del plan revisado');
      const original = await head(item.original_key);
      assert(original?.ETag === item.originalETag, 'El original cambió desde la preparación');
      const bytes = await fs.readFile(path.join(output, item.filename));
      assert(sha(bytes) === item.sha256, 'La miniatura local cambió');
      const existing = await head(item.thumbnail_key);
      if (existing) {
        const object = await client.send(new GetObjectCommand({ Bucket, Key: item.thumbnail_key }));
        assert(sha(Buffer.from(await object.Body.transformToByteArray())) === item.sha256, 'Existe otra miniatura: no sobrescribir');
      } else {
        await client.send(new PutObjectCommand({
          Bucket, Key: item.thumbnail_key, Body: bytes,
          ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable',
          IfNoneMatch: '*',
        }));
      }
      const uploaded = await client.send(new GetObjectCommand({ Bucket, Key: item.thumbnail_key }));
      assert(sha(Buffer.from(await uploaded.Body.transformToByteArray())) === item.sha256, 'No coincide la miniatura almacenada');
      assert((await head(item.original_key))?.ETag === item.originalETag, 'No se pudo confirmar el original');
      item.created = true;
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
    manifest.status = 'applied_and_verified';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: manifest.status, thumbnails: manifest.items.length, originalsModified: false, widths: manifest.items.map(item => item.width) }));
}

run().catch(error => {
  // No imprimir objetos del SDK, cabeceras ni credenciales.
  console.error(JSON.stringify({ status: 'stopped', reason: error.$metadata ? 'Fallo de almacenamiento; no continuar sin revisar' : error.message }));
  process.exitCode = 1;
});
