import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

const root = process.cwd();
const source = 'placas/origen/tejido.webp';
const requested = 'placas/destino/tejido.webp';
const thumbnail = key => key.replace(/\.[^.]+$/, '') + '_thumb.webp';

// Ejecutar las cuatro implementaciones reales sin cargar .env, abrir puertos
// ni permitir acceso a red. El único almacenamiento disponible es este Map.
function createHarness(kind, {
  failCopy = false, failThumbnail = false, failDelete = false,
  authorization = 'allowed', configured = true, storageConfigured = true,
} = {}) {
  const objects = new Map([
    [source, 'original'], [thumbnail(source), 'miniatura'],
    [requested, 'otro archivo'], [thumbnail(requested), 'otra miniatura'],
  ]);
  const deletions = [];
  const copy = (from, to) => {
    if (failCopy || (failThumbnail && from.endsWith('_thumb.webp'))) throw new Error('Fallo simulado');
    if (!objects.has(from)) throw new Error('No existe');
    objects.set(to, objects.get(from));
  };
  class CopyObjectCommand { constructor(input) { this.input = input; } }
  class DeleteObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  class S3Client {
    async send(command) {
      const input = command.input;
      if (command instanceof CopyObjectCommand) {
        copy(input.CopySource.slice('atlas-media/'.length), input.Key);
      } else if (command instanceof DeleteObjectCommand) {
        if (failDelete || (failThumbnail && input.Key.endsWith('_thumb.webp'))) throw new Error('Fallo de borrado simulado');
        deletions.push(input.Key);
        objects.delete(input.Key);
      } else if (command instanceof PutObjectCommand) {
        objects.set(input.Key, input.Body);
      } else throw new Error('Operación inesperada');
    }
  }
  const bucket = {
    async get(key) { return objects.has(key) ? { body: objects.get(key), httpMetadata: {} } : null; },
    async put(key, body) {
      if (failCopy || (failThumbnail && key.endsWith('_thumb.webp'))) throw new Error('Fallo simulado');
      objects.set(key, body);
    },
    async delete(key) {
      if (failDelete || (failThumbnail && key.endsWith('_thumb.webp'))) throw new Error('Fallo de borrado simulado');
      deletions.push(key); objects.delete(key);
    },
  };
  const routes = new Map();
  const register = method => (route, ...handlers) => {
    for (const key of Array.isArray(route) ? route : [route]) routes.set(`${method} ${key}`, handlers);
  };
  const app = {
    use() {}, get() {}, listen() {},
    delete: register('DELETE'), post: register('POST'),
  };
  const express = Object.assign(() => app, { json: () => () => {} });
  const multer = Object.assign(() => ({ any: () => (_req, _res, next) => next() }), { memoryStorage() {} });
  const env = {
    R2_ACCOUNT_ID: 'test', R2_ACCESS_KEY_ID: storageConfigured ? 'test' : '', R2_SECRET_ACCESS_KEY: 'test',
    R2_PUBLIC_DOMAIN: 'https://r2.atlas-tests.invalid', R2_BUCKET: storageConfigured ? bucket : undefined,
    SUPABASE_URL: configured ? 'https://supabase.atlas-tests.invalid' : '',
    SUPABASE_SERVICE_ROLE_KEY: configured ? 'server-test-key' : '',
  };
  const blockedNetwork = vi.fn(() => { throw new Error('Red prohibida'); });
  const authorizeRequest = vi.fn(async (url, options) => {
    if (url !== 'https://supabase.atlas-tests.invalid/rest/v1/rpc/atlas_authorize_token') return blockedNetwork();
    expect(JSON.parse(options.body)).toEqual({ p_token: 'test', p_roles: ['Administrador', 'Microscopía'] });
    if (authorization === 'network-error') throw new Error('Fallo de red simulado');
    if (authorization === 'invalid-json') return { ok: true, json: async () => { throw new Error('JSON inválido'); } };
    return { ok: authorization !== 'http-error', json: async () => authorization === 'allowed' ? true : authorization === 'denied' ? false : { allowed: true } };
  });
  const mocks = {
    'node:crypto': { randomUUID: () => 'unique-id' },
    express, cors: () => () => {}, multer, sharp: () => { throw new Error('Conversión inesperada'); },
    dotenv: { config() {} }, path,
    fs: { existsSync: () => false },
    vite: { defineConfig: value => value },
    '@vitejs/plugin-react': () => ({}),
    '@aws-sdk/client-s3': { S3Client, CopyObjectCommand, DeleteObjectCommand, PutObjectCommand },
  };
  function load(filename) {
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const requireMock = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), id);
        return load(existsSync(base + '.ts') ? base + '.ts' : base + '.js');
      }
      throw new Error(`Importación no aislada: ${id}`);
    };
    vm.runInNewContext(code, {
      module, exports: module.exports, require: requireMock,
      __dirname: path.dirname(filename), process: { env },
      Request, Response, URL, Buffer, fetch: authorizeRequest,
      crypto: { randomUUID: () => 'unique-id' },
      console: { log() {}, warn() {}, error() {} },
    }, { filename });
    return module.exports;
  }
  const uploadedFile = { name: 'test.webp', type: 'image/webp', size: 4, arrayBuffer: async () => new ArrayBuffer(4) };
  let invoke;
  if (kind === 'worker' || kind === 'functions') {
    const implementation = kind === 'worker' ? load(path.join(root, 'cloudflare/_worker.js')) : null;
    invoke = async ({ method, pathname, body, token }) => {
      const headers = new Headers(token ? { 'X-Atlas-Session': token } : {});
      const request = {
        url: `https://atlas-tests.invalid${pathname}`, method, headers,
        json: async () => body,
        formData: async () => new Map([['file', uploadedFile], ['thumb', uploadedFile]]),
      };
      const response = kind === 'worker'
        ? await implementation.default.fetch(request, env)
        : await load(path.join(root, `functions/api/${pathname.includes('delete') ? 'images-delete' : pathname.includes('upload') ? 'images-upload' : 'images-move'}.ts`)).onRequest({ request, env });
      return { status: response.status, body: await response.json() };
    };
  } else if (kind === 'express') {
    load(path.join(root, 'backend/server.js'));
    invoke = ({ method, pathname, body, token }) => new Promise((resolve, reject) => {
      const url = new URL(pathname, 'http://atlas-tests.invalid');
      const response = {
        statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(value) { resolve({ status: this.statusCode, body: value }); },
      };
      const request = {
        body, query: Object.fromEntries(url.searchParams), path: url.pathname,
        get: () => token, files: ['file', 'thumb'].map(fieldname => ({ fieldname, originalname: 'test.webp', mimetype: 'image/webp', buffer: Buffer.from('webp'), size: 4 })),
      };
      const handlers = routes.get(`${method} ${url.pathname}`);
      if (!handlers) return reject(new Error(`Ruta no registrada: ${pathname}`));
      const run = index => Promise.resolve(handlers[index](request, response, () => run(index + 1)));
      run(0).catch(reject);
    });
  } else {
    const config = load(path.join(root, 'vite.config.ts')).default;
    let middleware;
    config.plugins.find(plugin => plugin.name === 'r2-dev-server-api').configureServer({
      middlewares: { use(handler) { middleware = handler; } },
    });
    invoke = ({ method, pathname, body, token }) => new Promise((resolve, reject) => {
      const request = Object.assign(new EventEmitter(), {
        url: pathname, method, headers: token ? { 'x-atlas-session': token } : {}, body,
        files: ['file', 'thumb'].map(fieldname => ({ fieldname, originalname: 'test.webp', mimetype: 'image/webp', buffer: Buffer.from('webp'), size: 4 })),
      });
      const response = { statusCode: 200, setHeader() {}, end(value) { resolve({ status: this.statusCode, body: JSON.parse(value) }); } };
      Promise.resolve(middleware(request, response, () => reject(new Error('Ruta no atendida')))).then(() => {
        request.emit('data', JSON.stringify(body));
        request.emit('end');
      }).catch(reject);
    });
  }
  const call = (operation, options = {}) => invoke({
    method: operation === 'delete' ? 'DELETE' : 'POST',
    pathname: `/api/images-${operation}${operation === 'delete' ? `?publicId=${encodeURIComponent(source)}` : ''}`,
    body: operation === 'move' ? { from_public_id: source, to_public_id: requested } : {},
    token: 'test', ...options,
  });
  return { objects, deletions, blockedNetwork, authorizeRequest, call, move: () => call('move') };
}

describe.each(['worker', 'functions', 'express', 'vite'])('Transferencias R2: %s', kind => {
  function expectOriginals(harness) {
    expect(harness.objects.get(source)).toBe('original');
    expect(harness.objects.get(thumbnail(source))).toBe('miniatura');
    expect(harness.objects.get(requested)).toBe('otro archivo');
    expect(harness.objects.get(thumbnail(requested))).toBe('otra miniatura');
    expect(harness.deletions).toEqual([]);
    expect(harness.blockedNetwork).not.toHaveBeenCalled();
  }
  it('copia imagen y miniatura sin borrar el origen ni sobrescribir otros archivos', async () => {
    const harness = createHarness(kind);
    const result = await harness.move();
    expect(result.status).toBe(200);
    expect(result.body.public_id).not.toBe(requested);
    expect(result.body.public_id).toMatch(/^placas\/destino\/tejido_.+\.webp$/);
    expect(result.body.secure_url).toBe(`https://r2.atlas-tests.invalid/${result.body.public_id}`);
    expect(harness.objects.get(result.body.public_id)).toBe('original');
    expect(harness.objects.get(thumbnail(result.body.public_id))).toBe('miniatura');
    // Aunque posteriormente falle la escritura en la base de datos, el origen sigue disponible.
    expectOriginals(harness);
  });
  it('conserva los archivos existentes cuando falla la copia', async () => {
    const harness = createHarness(kind, { failCopy: true });
    expect((await harness.move()).status).toBe(500);
    expectOriginals(harness);
    expect(harness.objects.size).toBe(4);
  });
  it('conserva la miniatura original aunque falle su copia', async () => {
    const harness = createHarness(kind, { failThumbnail: true });
    expect((await harness.move()).status).toBe(200);
    expectOriginals(harness);
  });

  describe.each(['upload', 'move', 'delete'])('Permisos: %s', operation => {
    it.each([
      ['sesión ausente', {}, { token: '' }, 401],
      ['configuración ausente', { configured: false }, {}, 503],
      ['permiso rechazado', { authorization: 'denied' }, {}, 403],
      ['fallo de red', { authorization: 'network-error' }, {}, 503],
      ['fallo de servidor de permisos', { authorization: 'http-error' }, {}, 503],
      ['respuesta inesperada', { authorization: 'unexpected' }, {}, 503],
      ['JSON inválido', { authorization: 'invalid-json' }, {}, 503],
    ])('impide escribir con %s', async (_label, options, request, status) => {
      const harness = createHarness(kind, options);
      const original = [...harness.objects];
      const response = await harness.call(operation, request);
      expect(response.status).toBe(status);
      expect([...harness.objects]).toEqual(original);
      expect(harness.deletions).toEqual([]);
      expect(harness.blockedNetwork).not.toHaveBeenCalled();
    });

    it('informa que R2 no está disponible cuando falta su configuración', async () => {
      const harness = createHarness(kind, { storageConfigured: false });
      expect((await harness.call(operation)).status).toBe(503);
      expect(harness.deletions).toEqual([]);
    });
  });

  it('permite subir con autorización verificada', async () => {
    const harness = createHarness(kind);
    const response = await harness.call('upload');
    expect(response.status).toBe(200);
    expect(harness.objects.has(response.body.public_id)).toBe(true);
    expect(harness.authorizeRequest).toHaveBeenCalledTimes(1);
  });

  it('confirma el borrado solo después de eliminar imagen y miniatura', async () => {
    const harness = createHarness(kind);
    expect((await harness.call('delete')).status).toBe(200);
    expect(harness.objects.has(source)).toBe(false);
    expect(harness.objects.has(thumbnail(source))).toBe(false);
    expect(harness.objects.get(requested)).toBe('otro archivo');
  });

  it('no anuncia éxito ni borra la miniatura si falla el borrado del original', async () => {
    const harness = createHarness(kind, { failDelete: true });
    expect((await harness.call('delete')).status).toBe(500);
    expectOriginals(harness);
  });

  it('informa un fallo parcial si R2 rechaza borrar la miniatura', async () => {
    const harness = createHarness(kind, { failThumbnail: true });
    expect((await harness.call('delete')).status).toBe(500);
    expect(harness.objects.has(source)).toBe(false);
    expect(harness.objects.get(thumbnail(source))).toBe('miniatura');
  });

  it('rechaza un borrado sin clave sin usar el nombre del endpoint como archivo', async () => {
    const harness = createHarness(kind);
    expect((await harness.call('delete', { pathname: '/api/images-delete' })).status).toBe(400);
    expectOriginals(harness);
  });

  it('decodifica los parámetros una sola vez al borrar', async () => {
    const harness = createHarness(kind);
    const literalKey = 'atlas-content/corte%20original.webp';
    harness.objects.set(literalKey, 'archivo literal');
    harness.objects.set('atlas-content/corte original.webp', 'archivo distinto');
    expect((await harness.call('delete', { pathname: `/api/images-delete?publicId=${encodeURIComponent(literalKey)}` })).status).toBe(200);
    expect(harness.objects.has(literalKey)).toBe(false);
    expect(harness.objects.get('atlas-content/corte original.webp')).toBe('archivo distinto');
  });

  it('rechaza parámetros de movimiento del tipo incorrecto', async () => {
    const harness = createHarness(kind);
    expect((await harness.call('move', { body: { from_public_id: 42, to_public_id: requested } })).status).toBe(400);
    expectOriginals(harness);
  });
});
