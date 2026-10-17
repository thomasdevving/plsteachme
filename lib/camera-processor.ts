import 'server-only';

export class CameraProcessingUnavailable extends Error {}

/** Offload JPEG decoding to the existing Supabase project on Workers Free. */
export async function prepareCameraFrame(encoded: string, maxBytes: number): Promise<Buffer> {
  if (process.env.CAMERA_PROCESSOR !== 'supabase') {
    const { cleanCameraFrame } = await import('./camera-frame');
    return cleanCameraFrame(encoded, maxBytes);
  }
  if (!encoded || encoded.length > 4 * Math.ceil(maxBytes / 3)) throw new Error('Invalid frame');
  let response: Response;
  try {
    const base = new URL(process.env.SUPABASE_URL || '');
    // The service key must only travel to this project's Supabase endpoint.
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') ||
        base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error('Configuration');
    response = await fetch(new URL('/functions/v1/clean-camera-frame', base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), 'x-region': 'eu-central-1' },
      body: JSON.stringify({ encoded, maxBytes }),
    });
  } catch { throw new CameraProcessingUnavailable('Camera processing is temporarily unavailable.'); }
  if (response.status === 400 || response.status === 413) throw new Error('Invalid frame');
  if (!response.ok || response.headers.get('content-type') !== 'image/jpeg') {
    await response.body?.cancel();
    throw new CameraProcessingUnavailable('Camera processing is temporarily unavailable.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new CameraProcessingUnavailable('No processed image returned.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 1_048_576) { await reader.cancel(); throw new Error('Oversized image'); }
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error('Invalid processed image');
    return bytes;
  } catch { throw new CameraProcessingUnavailable('Camera processing is temporarily unavailable.'); }
  finally { reader.releaseLock(); }
}
