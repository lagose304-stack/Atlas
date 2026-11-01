const servePublicPlateImage = async (request: Request, publicDomain: string) => {
  const error = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return error(405, 'Método no permitido.');
  let source;
  try {
    source = new URL(new URL(request.url).searchParams.get('url') || '');
    const allowed = new URL(publicDomain);
    const prefix = allowed.pathname.replace(/\/+$/, '');
    if (source.protocol !== 'https:' || source.origin !== allowed.origin || source.username || source.password || (prefix && !source.pathname.startsWith(`${prefix}/`)) || !/\.(webp|png|jpe?g)$/i.test(source.pathname)) return error(400, 'La imagen debe pertenecer al almacenamiento público de Atlas.');
  } catch { return error(400, 'Dirección de imagen inválida.'); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const limit = 32 * 1024 * 1024;
  try {
    const response = await fetch(source.href, { redirect: 'error', signal: controller.signal });
    if (!response.ok) return error(response.status === 404 ? 404 : 502, 'No se pudo leer la imagen pública.');
    const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(type)) { await response.body?.cancel(); return error(415, 'Formato de imagen no compatible.'); }
    if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); return error(413, 'La imagen supera el tamaño permitido.'); }
    const reader = response.body?.getReader();
    if (!reader) return error(502, 'La imagen está vacía.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limit) { await reader.cancel(); return error(413, 'La imagen supera el tamaño permitido.'); }
      chunks.push(result.value);
    }
    if (!length) return error(502, 'La imagen está vacía.');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { headers: { 'Content-Type': type, 'Content-Length': String(length), 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return error(502, 'No se pudo descargar la imagen. Inténtalo de nuevo.'); }
  finally { clearTimeout(timer); }
};

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  return servePublicPlateImage(context.request, context.env.R2_PUBLIC_DOMAIN || 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev');
}
