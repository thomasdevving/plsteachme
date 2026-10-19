import 'server-only';
import { MAX_FRAME_PIXELS, sanitizeJpeg } from './jpeg';

type Sharp = typeof import('sharp')['default'];
let sharpLoader: Promise<Sharp | null> | null = null;
/** The native image library when this runtime can load it, otherwise null (for example on Cloudflare Workers). */
function loadSharp() {
  sharpLoader ??= import('sharp').then(module => module.default).catch(() => null);
  return sharpLoader;
}

/**
 * Prepares an untrusted camera JPEG for the vision model: bounded size and
 * dimensions, no metadata. With the native library the frame is fully
 * decoded, oriented and re-encoded at 640px; without it the JPEG structure
 * is validated and metadata segments are removed.
 */
export async function normalizeFrame(bytes: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  if (!sharp) return sanitizeJpeg(bytes);
  return sharp(bytes, { limitInputPixels: MAX_FRAME_PIXELS, failOn: 'warning' }).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
}
