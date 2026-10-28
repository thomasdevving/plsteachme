// Builds the installable app icons from the existing plsteach.me logo
// (public/brand/hands-filled.png). Run after changing the logo:
//   node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const CREAM = "#faf7f2";
const source = "public/brand/hands-filled.png";
const out = "public/icons";

/** The logo trimmed to its visible pixels, scaled to fit `size`. */
async function logo(size) {
  const trimmed = await sharp(source).trim().toBuffer();
  return sharp(trimmed).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** A cream tile with the logo centered; `scale` is the logo's share of the tile. */
async function tile(size, scale, radius = 0) {
  const inner = Math.round(size * scale);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${CREAM}"/></svg>`);
  return sharp(mask)
    .composite([{ input: await logo(inner), gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(out, { recursive: true });
const icons = [
  // "any": a rounded cream tile, as shown in Windows and macOS app launchers.
  ["icon-192.png", 192, 0.74, 42],
  ["icon-512.png", 512, 0.74, 112],
  // "maskable": full-bleed; the logo stays inside the 80% safe zone.
  ["maskable-512.png", 512, 0.58, 0],
  // Safari "Add to Dock" and iOS apply their own mask to a square icon.
  ["apple-touch-icon.png", 180, 0.7, 0],
];
for (const [name, size, scale, radius] of icons) {
  await sharp(await tile(size, scale, radius)).toFile(`${out}/${name}`);
  console.log(`${out}/${name}`);
}
