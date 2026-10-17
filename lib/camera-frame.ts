import 'server-only';
import { Buffer } from 'node:buffer';
import jpeg from 'jpeg-js';

const MAX_PIXELS = 1_048_576;

/** Read only the orientation tag, with every TIFF offset bounded to its APP1 segment. */
function orientation(bytes: Buffer): number {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('Invalid JPEG segment');
    const start = offset + 2;
    const end = offset + length;
    if (marker === 0xe1 && bytes.subarray(start, start + 6).toString('binary') === 'Exif\0\0') {
      const tiff = start + 6;
      const little = bytes.subarray(tiff, tiff + 2).toString() === 'II';
      const order = bytes.subarray(tiff, tiff + 2).toString();
      if (order !== 'II' && order !== 'MM') throw new Error('Invalid EXIF byte order');
      const read = (at: number, size: 2 | 4) => {
        if (at < tiff || at + size > end) throw new Error('Invalid EXIF offset');
        return size === 2 ? (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at))
          : (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at));
      };
      if (read(tiff + 2, 2) !== 42) throw new Error('Invalid EXIF header');
      const relative = read(tiff + 4, 4);
      if (relative < 8) throw new Error('Invalid EXIF directory');
      const directory = tiff + relative;
      const count = read(directory, 2);
      if (directory + 2 + count * 12 > end) throw new Error('Invalid EXIF directory');
      for (let i = 0; i < count; i++) {
        const entry = directory + 2 + i * 12;
        if (read(entry, 2) !== 0x112) continue;
        if (read(entry + 2, 2) !== 3 || read(entry + 4, 4) !== 1) throw new Error('Invalid EXIF orientation');
        const value = read(entry + 8, 2);
        if (value < 1 || value > 8) throw new Error('Invalid EXIF orientation');
        return value;
      }
    }
    offset = end;
  }
  return 1;
}

/** Portable, bounded JPEG decoding for Node and Workers; forwards pixels only. */
export function cleanCameraFrame(encoded: string, maxBytes: number): Buffer {
  if (encoded.length > 4 * Math.ceil(maxBytes / 3)) throw new Error('Invalid frame');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > maxBytes || bytes.toString('base64') !== encoded ||
    bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
    bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error('Invalid frame');
  const turn = orientation(bytes);
  const decoded = jpeg.decode(bytes, {
    useTArray: true, formatAsRGBA: true, tolerantDecoding: false,
    maxResolutionInMP: MAX_PIXELS / 1_000_000, maxMemoryUsageInMB: 32,
  });
  const { width: sourceWidth, height: sourceHeight, data: source } = decoded;
  if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > MAX_PIXELS) throw new Error('Invalid dimensions');
  const orientedWidth = turn >= 5 ? sourceHeight : sourceWidth;
  const orientedHeight = turn >= 5 ? sourceWidth : sourceHeight;
  const scale = Math.min(1, 640 / orientedWidth, 640 / orientedHeight);
  const width = Math.max(1, Math.round(orientedWidth * scale));
  const height = Math.max(1, Math.round(orientedHeight * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ox = (x + 0.5) * orientedWidth / width - 0.5;
      const oy = (y + 0.5) * orientedHeight / height - 0.5;
      let sx = ox, sy = oy;
      if (turn === 2) sx = sourceWidth - 1 - ox;
      if (turn === 3) { sx = sourceWidth - 1 - ox; sy = sourceHeight - 1 - oy; }
      if (turn === 4) sy = sourceHeight - 1 - oy;
      if (turn === 5) { sx = oy; sy = ox; }
      if (turn === 6) { sx = oy; sy = sourceHeight - 1 - ox; }
      if (turn === 7) { sx = sourceWidth - 1 - oy; sy = sourceHeight - 1 - ox; }
      if (turn === 8) { sx = sourceWidth - 1 - oy; sy = ox; }
      sx = Math.max(0, Math.min(sourceWidth - 1, sx));
      sy = Math.max(0, Math.min(sourceHeight - 1, sy));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(sourceWidth - 1, x0 + 1), y1 = Math.min(sourceHeight - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const target = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const top = source[(y0 * sourceWidth + x0) * 4 + channel] * (1 - fx) + source[(y0 * sourceWidth + x1) * 4 + channel] * fx;
        const bottom = source[(y1 * sourceWidth + x0) * 4 + channel] * (1 - fx) + source[(y1 * sourceWidth + x1) * 4 + channel] * fx;
        data[target + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
      data[target + 3] = 255;
    }
  }
  // Never pass decoded EXIF, comments or ICC data to the encoder.
  return Buffer.from(jpeg.encode({ width, height, data }, 65).data);
}
