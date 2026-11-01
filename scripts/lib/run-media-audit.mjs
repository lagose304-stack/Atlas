import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { collectReferences, listObjects, compareReferences, checkHttpReferences } from './media-audit.mjs';
import { resolveImageLocation } from '../../src/services/r2ImageLocation.mjs';

export async function runMediaAudit(mode) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const parse = async filename => {
    try { return dotenv.parse(await fs.readFile(path.join(root, filename))); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  };
  const env = { ...await parse('backend/.env'), ...await parse('.env'), ...process.env };
  // Sin clave privilegiada, RLS podría ocultar filas y producir un falso informe completo.
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env[key]) throw new Error(`Falta ${key}; auditoría no ejecutada`);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const domain = (env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev').replace(/\/+$/, '');
  const report = { checkedAt: new Date().toISOString(), mode, readOnly: true, ...await collectReferences(client) };
  const locations = report.references.map(ref => resolveImageLocation(ref.url, domain));
  report.referenceStats = {
    storedMedia: locations.filter(item => item.storage).length,
    legacyReferences: locations.filter(item => item.legacy).length,
    nonWebpStorageKeys: locations.filter(item => item.storage && !item.key.endsWith('.webp')).length,
    externalOrNavigation: locations.filter(item => !item.storage).length,
  };
  if (mode === 'integrity') {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) if (!env[key]) throw new Error(`Falta ${key}; inventario no ejecutado`);
    const r2 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
    const objects = await listObjects(r2.send.bind(r2), ListObjectsV2Command, env.R2_BUCKET_NAME);
    report.inventoryObjects = objects.size;
    report.results = compareReferences(report.references, objects, domain);
    report.unreferencedObjectsNotEvaluated = true;
  } else if (mode === 'http') {
    report.results = await checkHttpReferences(report.references, domain, fetch);
    report.httpScope = 'originals_in_known_storage_only';
  }
  const findings = (report.results || []).filter(item => !['available', 'external_or_navigation'].includes(item.status)
    || item.legacy || item.status === 'available' && item.thumbnailStatus && item.thumbnailStatus !== 'available');
  const outputDir = path.join(root, 'recovered_images/audits');
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `media-${mode}-${Date.now()}.json`;
  await fs.writeFile(path.join(outputDir, filename), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ mode, complete: report.complete, tables: report.coverage.length,
    failedTables: report.coverage.filter(item => !item.complete), references: report.references.length,
    findings: mode === 'references' ? report.referenceStats.legacyReferences : findings.length,
    referenceStats: report.referenceStats, report: `recovered_images/audits/${filename}` }, null, 2));
  if (!report.complete) process.exitCode = 2;
  else if (findings.length || report.referenceStats.legacyReferences) process.exitCode = 1;
}

export function auditFailed(error) {
  console.error(error.message?.startsWith('Falta ') ? error.message : 'Auditoría incompleta: no se pudo completar la lectura.');
  process.exitCode = 2;
}
