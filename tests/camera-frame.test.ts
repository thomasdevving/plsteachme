import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { cleanCameraFrame } from '../lib/camera-frame';

describe('portable camera image boundary', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('preserves EXIF orientation %i while removing metadata', async (orientation) => {
    const width = 80, height = 48;
    const pixels = Buffer.alloc(width * height * 3);
    const colors = [[220, 30, 30], [30, 220, 30], [30, 30, 220], [220, 220, 30]];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const color = colors[Number(x >= width / 2) + 2 * Number(y >= height / 2)];
      for (let c = 0; c < 3; c++) pixels[(y * width + x) * 3 + c] = color[c];
    }
    const original = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .withMetadata({ orientation }).jpeg({ quality: 95 }).toBuffer();
    const cleaned = cleanCameraFrame(original.toString('base64'), 300_000);
    const metadata = await sharp(cleaned).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    const expected = await sharp(original).autoOrient().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const actual = await sharp(cleaned).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(actual.info).toMatchObject({ width: expected.info.width, height: expected.info.height, channels: 3 });
    for (const yf of [0.25, 0.75]) for (const xf of [0.25, 0.75]) {
      const at = (Math.floor(actual.info.height * yf) * actual.info.width + Math.floor(actual.info.width * xf)) * 3;
      for (let c = 0; c < 3; c++) expect(Math.abs(actual.data[at + c] - expected.data[at + c])).toBeLessThan(15);
    }
  });
  it('resizes a portrait inside 640 pixels without enlarging small images', async () => {
    const bytes = await sharp({ create: { width: 600, height: 800, channels: 3, background: 'white' } }).jpeg().toBuffer();
    expect(await sharp(cleanCameraFrame(bytes.toString('base64'), 300_000)).metadata()).toMatchObject({ width: 480, height: 640 });
  });
  it('rejects truncated, oversized and non-canonical payloads', async () => {
    const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'white' } }).jpeg().toBuffer();
    expect(() => cleanCameraFrame(bytes.subarray(0, bytes.length - 2).toString('base64'), 300_000)).toThrow();
    expect(() => cleanCameraFrame(bytes.toString('base64') + '\n', 300_000)).toThrow();
    expect(() => cleanCameraFrame(bytes.toString('base64'), bytes.length - 1)).toThrow();
    const huge = await sharp({ create: { width: 1025, height: 1024, channels: 3, background: 'white' } }).jpeg().toBuffer();
    expect(() => cleanCameraFrame(huge.toString('base64'), 300_000)).toThrow();
  });
});
