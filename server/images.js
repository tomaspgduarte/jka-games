export const MAX_IMAGE_BYTES = 300 * 1024;
export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;

// Accept only bounded raster files. No SVG, remote fetch or executable markup.
export function decodeImage(value) {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_BYTES * 4 / 3 + 64) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return null;
  const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
    match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return valid ? { bytes, mime: match[1] } : null;
}
