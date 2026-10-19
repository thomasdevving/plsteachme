// A dependency-free JPEG sanitizer for runtimes without the native image
// library (such as Cloudflare Workers). It walks the JPEG segment structure,
// bounds the declared dimensions, and rebuilds the file without metadata
// segments (EXIF, XMP, ICC profiles, comments), so nothing but image data is
// forwarded. Frames come from a browser canvas, which never writes EXIF.

export const MAX_FRAME_PIXELS = 1_048_576;
const SOI = [0xff, 0xd8], EOI = [0xff, 0xd9];
const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;
// Start-of-frame markers carry dimensions; C4 (Huffman), C8 and CC (arithmetic tables) do not.
const isFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
// APP1–APP15 hold EXIF, XMP, ICC and vendor data; FE is a free-text comment. APP0 (JFIF) is kept.
const isMetadata = (marker: number) => (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;

export function sanitizeJpeg(bytes: Uint8Array, maxPixels = MAX_FRAME_PIXELS): Buffer {
  const fail = (reason: string): never => { throw new Error(`Invalid JPEG: ${reason}`); };
  if (bytes[0] !== SOI[0] || bytes[1] !== SOI[1]) fail('missing start marker');
  const parts: Uint8Array[] = [Uint8Array.from(SOI)];
  let i = 2, frame = false, scan = false;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) fail('expected a marker');
    while (bytes[i + 1] === 0xff) i++; // Fill bytes before a marker.
    const marker = bytes[i + 1];
    if (marker === undefined) fail('truncated');
    if (marker === 0xd9) {
      if (!scan) fail('no image data');
      parts.push(Uint8Array.from(EOI));
      return Buffer.concat(parts);
    }
    if (isRestart(marker) || marker === 0x01) { i += 2; continue; }
    if (i + 4 > bytes.length) fail('truncated');
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) fail('bad segment length');
    const segment = bytes.subarray(i, i + 2 + length);
    if (isFrame(marker)) {
      if (length < 8) fail('bad frame header');
      const height = (segment[5] << 8) | segment[6], width = (segment[7] << 8) | segment[8];
      if (!width || !height || width * height > maxPixels) fail('dimensions out of range');
      frame = true;
    }
    if (!isMetadata(marker)) parts.push(segment);
    i += 2 + length;
    if (marker === 0xda) {
      if (!frame) fail('scan before frame');
      scan = true;
      // Entropy-coded data runs until a marker that is not stuffing (FF00) or a restart.
      let end = i;
      while (end < bytes.length) {
        if (bytes[end] === 0xff && end + 1 < bytes.length) {
          const next = bytes[end + 1];
          if (next === 0x00 || isRestart(next)) { end += 2; continue; }
          if (next === 0xff) { end += 1; continue; }
          break;
        }
        end++;
      }
      parts.push(bytes.subarray(i, end));
      i = end;
    }
  }
  return fail('missing end marker');
}
