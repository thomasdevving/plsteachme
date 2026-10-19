import { expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
// Simulates runtimes such as Cloudflare Workers, where the native module cannot load.
vi.mock('sharp',()=>{throw new Error('Could not load the "sharp" module');});
vi.mock('server-only',()=>({}));
import { normalizeFrame } from '../lib/vision/frames';

it('falls back to the sanitizer when the native image library is unavailable',async()=>{
  // A real camera-style JPEG with an EXIF comment, generated ahead of time without sharp.
  const jpeg=Buffer.from(await readFile(new URL('./fixtures/exif-frame.jpg',import.meta.url)));
  expect(jpeg.includes(Buffer.from('fixture-exif-secret'))).toBe(true);
  const clean=await normalizeFrame(jpeg);
  expect(clean.includes(Buffer.from('fixture-exif-secret'))).toBe(false);
  expect([clean[0],clean[1],clean.at(-2),clean.at(-1)]).toEqual([0xff,0xd8,0xff,0xd9]);
});
