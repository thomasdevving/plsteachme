import { withSupabase } from '@supabase/server';
import { cleanCameraFrame } from '../../../lib/camera-frame.ts';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
// Only the site's server may call this function. No browser/public key access.
// The platform JWT gate is disabled because this validates a modern secret key.
Deno.serve(withSupabase({ auth: 'secret:*' }, async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (request.headers.get('content-type') !== 'application/json') return new Response(null, { status: 400, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let length = 0;
  const timer = setTimeout(() => { void reader.cancel(); }, 5000);
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 400_100) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      chunks.push(next.value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const { encoded, maxBytes } = JSON.parse(new TextDecoder().decode(body));
    if (typeof encoded !== 'string' || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 300_000) throw new Error('Invalid request');
    const image = cleanCameraFrame(encoded, maxBytes);
    return new Response(new Uint8Array(image), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
  } catch {
    // Never log images, credentials, request bodies or raw decoder errors.
    return new Response(null, { status: 400, headers });
  } finally { clearTimeout(timer); reader.releaseLock(); }
}));
