#!/usr/bin/env node
/**
 * Maak een release: zet de versie, synchroniseer alle bestanden, commit en tag.
 *
 *   npm run release -- 0.3.0            versie zetten, committen, tag v0.3.0 maken
 *   npm run release -- 0.3.0 --push     plus pushen van main en de tag (start de release-workflow)
 *   npm run release -- patch|minor|major
 *
 * De GitHub Actions-workflow release.yml bouwt daarna web, Windows en Android en publiceert de release.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const push = process.argv.includes('--push');
const target = args[0];

if (!target) {
  console.error('Gebruik: npm run release -- <versie|patch|minor|major> [--push]');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const out = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

if (out('git status --porcelain') !== '') {
  console.error('Werkmap is niet schoon. Commit of stash eerst je wijzigingen.');
  process.exit(1);
}

const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = String(pkg.version).split('.').map(Number);
let next = target;
if (target === 'patch') next = `${maj}.${min}.${pat + 1}`;
if (target === 'minor') next = `${maj}.${min + 1}.0`;
if (target === 'major') next = `${maj + 1}.0.0`;
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Ongeldige versie: ${next}`);
  process.exit(1);
}

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
run('node scripts/sync-version.mjs');
run('git add package.json frontend/package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml android/app/build.gradle backend/VERSION');
run(`git commit -m "Release v${next}"`);
run(`git tag -a v${next} -m "v${next}"`);
console.log(`\nVersie v${next} gecommit en getagd.`);
if (push) {
  const branch = out('git rev-parse --abbrev-ref HEAD');
  run(`git push origin ${branch}`);
  run(`git push origin v${next}`);
  console.log('Gepusht. De release-workflow bouwt nu web, Windows en Android.');
} else {
  console.log(`Push met: git push origin $(git rev-parse --abbrev-ref HEAD) && git push origin v${next}`);
}
