import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const files = ['vite.config.ts', 'backend/server.js', 'cloudflare/_worker.js', 'functions/api/plate-image.ts'];
const domain = 'https://r2.atlas-tests.invalid';
const image = `${domain}/placas/amigdala.webp?v=2`;
const request = (url = image, method = 'GET') => new Request(`https://atlas-tests.invalid/api/plate-image?url=${encodeURIComponent(url)}`, { method });

function harness(file, response = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } })) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('const servePublicPlateImage = async');
  const end = source.indexOf('\n};', start) + 3;
  const javascript = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const fetch = vi.fn(response);
  const context = { Request, Response, URL, Uint8Array, AbortController, setTimeout, clearTimeout, fetch };
  vm.runInNewContext(`${javascript}\nglobalThis.serve = servePublicPlateImage;`, context);
  return { serve: context.serve, fetch };
}

describe.each(files)('Lectura pública acotada para exportar: %s', file => {
  it('lee únicamente la imagen pública, sin sesión, y no reenvía credenciales', async () => {
    const h = harness(file);
    const result = await h.serve(request(), domain);
    expect(result.status).toBe(200);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.headers.get('Content-Type')).toBe('image/webp');
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(h.fetch).toHaveBeenCalledWith(image, { redirect: 'error', signal: expect.anything() });
  });
  it('rechaza destinos externos, credenciales en URL, SVG y métodos de escritura sin consultar la red', async () => {
    const h = harness(file);
    for (const url of ['https://example.com/a.webp', `${domain}.evil.test/a.webp`, `${domain}/a.svg`, `${domain.replace('https:', 'http:')}/a.webp`, `https://user:password@r2.atlas-tests.invalid/a.webp`]) {
      expect((await h.serve(request(url), domain)).status).toBe(400);
    }
    expect((await h.serve(request(image, 'POST'), domain)).status).toBe(405);
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('respeta el prefijo configurado y no sigue redirecciones', async () => {
    const h = harness(file, () => { throw new Error('Redirect bloqueado'); });
    expect((await h.serve(request(`${domain}/other/a.webp`), `${domain}/media`)).status).toBe(400);
    expect((await h.serve(request(`${domain}/media/a.webp`), `${domain}/media`)).status).toBe(502);
    expect(h.fetch.mock.calls[0][1].redirect).toBe('error');
  });
  it('rechaza respuestas ajenas a imágenes y objetos demasiado grandes', async () => {
    const html = harness(file, () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
    expect((await html.serve(request(), domain)).status).toBe(415);
    const large = harness(file, () => new Response('x', { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(33 * 1024 * 1024) } }));
    expect((await large.serve(request(), domain)).status).toBe(413);
    const missing = harness(file, () => new Response('', { status: 404 }));
    expect((await missing.serve(request(), domain)).status).toBe(404);
  });
});

it('limita también un flujo sin Content-Length antes de almacenarlo completo', async () => {
  const block = new Uint8Array(16 * 1024 * 1024);
  const h = harness('cloudflare/_worker.js', () => new Response(new ReadableStream({ start(controller) { controller.enqueue(block); controller.enqueue(block); controller.enqueue(new Uint8Array([1])); controller.close(); } }), { headers: { 'Content-Type': 'image/webp' } }));
  expect((await h.serve(request(), domain)).status).toBe(413);
});

it('la ruta pública del Worker despacha la lectura sin pasar por autenticación ni ASSETS', async () => {
  const source = readFileSync('cloudflare/_worker.js', 'utf8').replace('export default', 'globalThis.worker =');
  const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } }));
  const context = { Request, Response, URL, Uint8Array, AbortController, setTimeout, clearTimeout, fetch };
  vm.runInNewContext(source, context);
  const assets = vi.fn(() => { throw new Error('No debe delegar en ASSETS'); });
  const result = await context.worker.fetch(request(), { R2_PUBLIC_DOMAIN: domain, ASSETS: { fetch: assets } });
  expect(result.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(assets).not.toHaveBeenCalled();
});

it('la función alternativa comparte el mismo contrato de lectura pública', async () => {
  const source = ts.transpileModule(readFileSync('functions/api/plate-image.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, Request, Response, URL, Uint8Array, AbortController, setTimeout, clearTimeout, fetch: vi.fn(async () => new Response(new Uint8Array([2]), { headers: { 'Content-Type': 'image/webp' } })) };
  vm.runInNewContext(source, context);
  const result = await context.exports.onRequest({ request: request(), env: { R2_PUBLIC_DOMAIN: domain } });
  expect(result.status).toBe(200);
});

describe('Lectura directa de R2 en el Worker desplegado', () => {
  function workerHarness(get) {
    const source = readFileSync('cloudflare/_worker.js', 'utf8').replace('export default', 'globalThis.worker =');
    const fetch = vi.fn(() => { throw new Error('El acceso HTTP público falla en producción'); });
    const context = { Request, Response, URL, Uint8Array, AbortController, setTimeout, clearTimeout, fetch };
    vm.runInNewContext(source, context);
    const env = { R2_PUBLIC_DOMAIN: `${domain}/media`, R2_BUCKET: { get: vi.fn(get) }, ASSETS: { fetch: vi.fn() } };
    return { env, fetch, serve: url => context.worker.fetch(request(url), env) };
  }
  const object = () => ({ body: new Response(new Uint8Array([4, 5, 6])).body, size: 3, httpMetadata: { contentType: 'image/webp' } });

  it('exporta aunque falle HTTP público y resuelve espacios, acentos, prefijo y versión de caché', async () => {
    const h = workerHarness(object);
    const result = await h.serve(`${domain}/media/placas/Am%C3%ADgdala%20palatina.webp?v=2`);
    expect(result.status).toBe(200);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]));
    expect(result.headers.get('Content-Type')).toBe('image/webp');
    expect(h.env.R2_BUCKET.get).toHaveBeenCalledWith('placas/Amígdala palatina.webp');
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('valida el destino antes de acceder al bucket', async () => {
    const h = workerHarness(object);
    for (const url of [`${domain}/other/a.webp`, 'https://other.invalid/a.webp', `${domain}/media/a.svg`, `${domain}/media/%ZZ.webp`]) {
      expect((await h.serve(url)).status).toBe(400);
    }
    expect(h.env.R2_BUCKET.get).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('conserva los errores de objeto ausente, formato inválido, tamaño excesivo y fallo de R2', async () => {
    const cases = [
      [() => null, 404],
      [() => ({ ...object(), httpMetadata: { contentType: 'text/html' } }), 415],
      [() => ({ ...object(), size: 33 * 1024 * 1024 }), 413],
      [() => { throw new Error('R2 no disponible'); }, 502],
    ];
    for (const [get, status] of cases) {
      const h = workerHarness(get);
      expect((await h.serve(`${domain}/media/a.webp`)).status).toBe(status);
      expect(h.fetch).not.toHaveBeenCalled();
    }
  });

  it('interrumpe una lectura del binding que no responde en 20 segundos', async () => {
    vi.useFakeTimers();
    try {
      const h = workerHarness(() => new Promise(() => {}));
      const pending = h.serve(`${domain}/media/a.webp`);
      await vi.advanceTimersByTimeAsync(20000);
      expect((await pending).status).toBe(502);
      expect(h.fetch).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
