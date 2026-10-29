import { readFileSync } from 'node:fs';

export const MAX_IMAGE_BYTES = 300 * 1024;
export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;

const hasSignature = (bytes, mime) => mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
  mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';

// Accept only bounded raster files. No SVG, remote fetch or executable markup.
export function decodeImage(value) {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_BYTES * 4 / 3 + 64) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return null;
  return hasSignature(bytes, match[1]) ? { bytes, mime: match[1] } : null;
}

const BANK_IMAGES = new URL('./content/images/', import.meta.url);
const bankCache = new Map();

// Bank photos ship as files in server/content/images; only plain names from that folder are served.
export function loadBankImage(name) {
  if (typeof name !== 'string' || !/^[a-z0-9-]+\.(?:jpg|png)$/.test(name)) return null;
  if (!bankCache.has(name)) {
    const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    let image = null;
    try {
      const bytes = readFileSync(new URL(name, BANK_IMAGES));
      if (bytes.length && bytes.length <= MAX_IMAGE_BYTES && hasSignature(bytes, mime)) image = { bytes, mime };
    } catch { /* A missing file stays invalid. */ }
    bankCache.set(name, image);
  }
  return bankCache.get(name);
}
