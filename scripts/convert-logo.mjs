import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webp = join(root, 'assets', 'codex-logo.webp');
const png = join(root, 'assets', 'codex-logo.png');
const sharpPath = join(root, 'frontend', 'node_modules', 'sharp', 'lib', 'index.js');

if (!existsSync(webp)) {
  console.error('Missing source logo:', webp);
  process.exit(1);
}

const { default: sharp } = await import(pathToFileURL(sharpPath).href);

await sharp(webp)
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .png()
  .toFile(png);

console.log('Converted', webp, '→', png);
