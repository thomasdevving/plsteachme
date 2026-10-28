import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import manifest from '../app/manifest';

describe('web app manifest', () => {
  const value = manifest();
  it('identifies one installable learning app that starts in /learn', () => {
    expect(value).toMatchObject({ id: '/learn', name: 'plsteach.me', start_url: '/learn', scope: '/', display: 'standalone', background_color: '#faf7f2', theme_color: '#22372c' });
    expect(value.short_name!.length).toBeLessThanOrEqual(12);
    // The start URL must be inside the scope, or browsers ignore it.
    expect(value.start_url!.startsWith(value.scope!)).toBe(true);
  });
  it('has regular and maskable icons with their declared sizes', async () => {
    const icons = value.icons ?? [];
    expect(icons.some((icon) => icon.purpose === 'any' && icon.sizes === '192x192')).toBe(true);
    expect(icons.some((icon) => icon.purpose === 'any' && icon.sizes === '512x512')).toBe(true);
    expect(icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(true);
    for (const icon of [...icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]) {
      const file = `public${icon.src}`;
      expect(existsSync(file), file).toBe(true);
      const meta = await sharp(file).metadata();
      expect(`${meta.width}x${meta.height}`).toBe(icon.sizes);
      expect(meta.format).toBe('png');
    }
  });
  it('gives the maskable icon an opaque cream background', async () => {
    const { data } = await sharp('public/icons/maskable-512.png').raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 4)]).toEqual([0xfa, 0xf7, 0xf2, 255]);
  });
});
