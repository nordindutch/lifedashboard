import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharpPath = join(root, 'frontend', 'node_modules', 'sharp', 'lib', 'index.js');
const { default: sharp } = await import(pathToFileURL(sharpPath).href);

const source = join(root, 'assets', 'codex-logo.png');
const tauriIcons = join(root, 'src-tauri', 'icons');
const androidRes = join(root, 'android', 'app', 'src', 'main', 'res');
const publicDir = join(root, 'frontend', 'public');

if (!existsSync(source)) {
  console.error('Missing source image:', source);
  process.exit(1);
}

function copyDir(src, dest) {
  if (!existsSync(src)) {
    return;
  }
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      cpSync(from, to);
    }
  }
}

async function writeSquarePng(size, outPath, paddingRatio = 0.08) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;
  await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toFile(outPath);
}

console.log('Syncing Android launcher icons from src-tauri/icons/android …');
const androidGenerated = join(tauriIcons, 'android');
for (const entry of readdirSync(androidGenerated, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) {
    continue;
  }
  copyDir(join(androidGenerated, entry.name), join(androidRes, entry.name));
}

mkdirSync(publicDir, { recursive: true });
await writeSquarePng(512, join(publicDir, 'icon-512.png'));
await writeSquarePng(192, join(publicDir, 'icon-192.png'));
await writeSquarePng(32, join(publicDir, 'favicon.png'));
cpSync(join(publicDir, 'favicon.png'), join(publicDir, 'apple-touch-icon.png'));

const splashTargets = [
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable', 480, 800],
];

console.log('Generating Android splash screens …');
for (const [folder, width, height] of splashTargets) {
  const dir = join(androidRes, folder);
  mkdirSync(dir, { recursive: true });
  const logoMax = Math.round(Math.min(width, height) * 0.42);
  const logo = await sharp(source)
    .resize(logoMax, logoMax, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(dir, 'splash.png'));
}

const launcherBackgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
`;
writeFileSync(join(androidRes, 'values', 'ic_launcher_background.xml'), launcherBackgroundXml);
mkdirSync(join(tauriIcons, 'android', 'values'), { recursive: true });
writeFileSync(
  join(tauriIcons, 'android', 'values', 'ic_launcher_background.xml'),
  launcherBackgroundXml.replace('    ', '  '),
);

console.log('Done.');
