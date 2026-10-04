#!/usr/bin/env node
/**
 * Eén versiebron: "version" in de root package.json.
 * Synchroniseert naar:
 *   - frontend/package.json          (version)
 *   - src-tauri/tauri.conf.json      (version)
 *   - src-tauri/Cargo.toml           ([package] version)
 *   - android/app/build.gradle       (versionName en versionCode)
 *   - backend/VERSION                (gelezen door /api/version)
 *
 * versionCode = major * 10000 + minor * 100 + patch (monotoon stijgend, past in een int).
 *
 * Gebruik:  node scripts/sync-version.mjs          schrijft alle bestanden
 *           node scripts/sync-version.mjs --check  faalt als iets niet overeenkomt (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = String(rootPkg.version ?? '').trim();
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  console.error(`Ongeldige versie in package.json: "${version}" (verwacht major.minor.patch)`);
  process.exit(1);
}
const [, major, minor, patch] = match.map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

let changed = 0;
let mismatches = [];

function apply(relPath, transform) {
  const path = resolve(root, relPath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    if (check) {
      mismatches.push(relPath);
    } else {
      writeFileSync(path, after);
      changed++;
      console.log(`  bijgewerkt ${relPath}`);
    }
  }
}

function replaceOrFail(content, regex, replacement, relPath) {
  if (!regex.test(content)) {
    console.error(`Patroon niet gevonden in ${relPath}: ${regex}`);
    process.exit(1);
  }
  return content.replace(regex, replacement);
}

apply('frontend/package.json', (c) => {
  const json = JSON.parse(c);
  if (json.version === version) {
    return c;
  }
  json.version = version;
  return `${JSON.stringify(json, null, 2)}\n`;
});

apply('src-tauri/tauri.conf.json', (c) => replaceOrFail(c, /"version":\s*"[^"]*"/, `"version": "${version}"`, 'src-tauri/tauri.conf.json'));

apply('src-tauri/Cargo.toml', (c) =>
  replaceOrFail(c, /(\[package\][\s\S]*?\nversion\s*=\s*)"[^"]*"/, `$1"${version}"`, 'src-tauri/Cargo.toml'),
);

apply('android/app/build.gradle', (c) => {
  let out = replaceOrFail(c, /versionCode\s+\d+/, `versionCode ${versionCode}`, 'android/app/build.gradle');
  out = replaceOrFail(out, /versionName\s+"[^"]*"/, `versionName "${version}"`, 'android/app/build.gradle');
  return out;
});

apply('backend/VERSION', (c) => (c.trim() === version ? c : `${version}\n`));

if (check) {
  if (mismatches.length > 0) {
    console.error(`Versie ${version} is niet gesynchroniseerd naar:\n  ${mismatches.join('\n  ')}\nDraai: npm run version:sync`);
    process.exit(1);
  }
  console.log(`Versie ${version} (versionCode ${versionCode}) is overal gelijk.`);
} else {
  console.log(`Versie ${version} (Android versionCode ${versionCode}): ${changed} bestand(en) bijgewerkt.`);
}
