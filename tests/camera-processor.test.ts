import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CameraProcessingUnavailable, prepareCameraFrame } from '../lib/camera-processor';

const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv('CAMERA_PROCESSOR', 'supabase');
  vi.stubEnv('SUPABASE_URL', 'https://testproject.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-secret');
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('private camera processor', () => {
  it('uses only the project endpoint, rejects redirects, and returns processed bytes', async () => {
    const image = Uint8Array.from([255, 216, 255, 217]);
    fetcher.mockResolvedValue(new Response(image, { headers: { 'Content-Type': 'image/jpeg' } }));
    expect(await prepareCameraFrame('encoded', 200_000)).toEqual(Buffer.from(image));
    const [url, request] = fetcher.mock.calls[0];
    expect(url.href).toBe('https://testproject.supabase.co/functions/v1/clean-camera-frame');
    expect(request.redirect).toBe('error');
    expect(request.headers.apikey).toBe('test-server-secret');
    expect(request.headers['x-region']).toBe('eu-central-1');
    expect(JSON.parse(request.body)).toEqual({ encoded: 'encoded', maxBytes: 200_000 });
  });
  it.each(['https://attacker.example', 'https://testproject.supabase.co.attacker.example', 'http://testproject.supabase.co', 'https://testproject.supabase.co/path'])('does not transmit the secret to %s', async url => {
    vi.stubEnv('SUPABASE_URL', url);
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.toBeInstanceOf(CameraProcessingUnavailable);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects oversized input before making a request', async () => {
    await expect(prepareCameraFrame('A'.repeat(200), 10)).rejects.toThrow('Invalid frame');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('distinguishes invalid images from unavailable infrastructure', async () => {
    fetcher.mockResolvedValueOnce(new Response(null, { status: 400 }));
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.not.toBeInstanceOf(CameraProcessingUnavailable);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.toBeInstanceOf(CameraProcessingUnavailable);
    fetcher.mockRejectedValueOnce(new Error('private provider detail'));
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.toThrow('Camera processing is temporarily unavailable.');
  });
  it('bounds response bytes and refuses non-image success responses', async () => {
    fetcher.mockResolvedValueOnce(new Response(new Uint8Array(1_048_577), { headers: { 'Content-Type': 'image/jpeg' } }));
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.toBeInstanceOf(CameraProcessingUnavailable);
    fetcher.mockResolvedValueOnce(new Response('unexpected HTML', { headers: { 'Content-Type': 'text/html' } }));
    await expect(prepareCameraFrame('encoded', 200_000)).rejects.toBeInstanceOf(CameraProcessingUnavailable);
  });
});
