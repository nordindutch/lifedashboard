# Deployment en updates

Eén versienummer, één workflow. Een push naar `main` deployt de server; een versietag (`v0.3.0`)
bouwt daarnaast de Windows-app en de Android-app en publiceert alles als GitHub Release. De
desktop-app werkt zichzelf bij via de Tauri-updater; de Android-app meldt een nieuwe versie met een
downloadlink.

## Overzicht

| Onderdeel | Hoe | Bestand |
| --- | --- | --- |
| Versiebron | `version` in de root `package.json` | `scripts/sync-version.mjs` |
| Release maken | `npm run release -- 0.3.0 --push` | `scripts/release.mjs` |
| CI (elke push naar main, elke PR) | typecheck, vitest, Vite-build, PHPUnit, migraties op lege DB | `.github/workflows/ci.yml` |
| Release (tag `v*`) | web-bundel, Windows installer + `latest.json`, Android APK/AAB, daarna deploy | `.github/workflows/release.yml` |
| Deploy naar VPS | SSH naar de server, draait `deploy/deploy.sh` | `.github/workflows/deploy.yml` |
| Server-script | back-up, migraties, healthcheck, rollback | `deploy/deploy.sh` |
| Versie-endpoint | `GET /api/version`, `GET /api/health` (publiek) | `backend/src/Modules/Core/VersionController.php` |
| Desktop-updater | `tauri-plugin-updater`, melding bij opstarten | `src-tauri/tauri.conf.json`, `frontend/src/lib/updater.ts` |
| Android-update | in-app controle tegen `/api/version` | `frontend/src/lib/updater.ts`, `UpdateBanner.tsx` |

## Versiebeheer

De bron is `version` in `/package.json`. `npm run version:sync` schrijft hem naar:

- `frontend/package.json`
- `src-tauri/tauri.conf.json` en `src-tauri/Cargo.toml`
- `android/app/build.gradle`: `versionName` en `versionCode` (= major x 10000 + minor x 100 + patch)
- `backend/VERSION` (gelezen door `/api/version`)

CI faalt op `npm run version:check` als een bestand afwijkt. Pas dus nooit een versie met de hand aan.

## Een release maken (één commando)

```bash
# werkmap moet schoon zijn
npm run release -- 0.3.0 --push      # of: patch | minor | major
```

Dit zet de versie, synchroniseert alle bestanden, commit `Release v0.3.0`, maakt tag `v0.3.0` en pusht.
De workflow `release.yml` doet de rest:

1. **verify**: tag moet gelijk zijn aan de versie, PHP-tests draaien.
2. **web**: `frontend/dist` als `codex-web-<versie>.tar.gz` bij de release.
3. **windows**: `tauri-action` bouwt de NSIS-installer en MSI, ondertekent ze met de updater-sleutel en
   publiceert `latest.json` (de updater leest die).
4. **android**: `cap sync`, ondertekende `codex-android.apk` en `codex-android.aab` bij de release.
5. **deploy**: na de web-build wordt `deploy.yml` aangeroepen die de VPS bijwerkt naar de tag.

Zonder tag: elke push naar `main` die CI haalt, deployt ook automatisch (`workflow_run`), maar bouwt geen
apps. Dat is de snelle route voor kleine web-wijzigingen. Omdat de Android-app de web-UI live van de
server laadt, zien gebruikers die wijzigingen meteen.

## Secrets in GitHub (Settings > Secrets and variables > Actions)

| Secret | Gebruikt door | Waarde |
| --- | --- | --- |
| `DEPLOY_HOST` | deploy.yml | hostnaam of IP van de Vimexx VPS |
| `DEPLOY_USER` | deploy.yml | SSH-gebruiker (dezelfde als nu voor `~/codex`) |
| `DEPLOY_SSH_KEY` | deploy.yml | privé-sleutel (ed25519) zonder wachtwoord; publieke helft in `~/.ssh/authorized_keys` op de VPS |
| `DEPLOY_PORT` | deploy.yml, optioneel | SSH-poort, standaard 22 |
| `DEPLOY_PATH` | deploy.yml, optioneel | map op de server, standaard `$HOME/codex` |
| `TAURI_SIGNING_PRIVATE_KEY` | release.yml (windows) | inhoud van `~/.tauri/codex.key` (zie hieronder) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | release.yml (windows) | wachtwoord van die sleutel (leeg laten als geen) |
| `ANDROID_KEYSTORE_BASE64` | release.yml (android) | `base64 -w0 codex.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | release.yml (android) | keystore-wachtwoord |
| `ANDROID_KEY_ALIAS` | release.yml (android) | alias in de keystore |
| `ANDROID_KEY_PASSWORD` | release.yml (android) | wachtwoord van de key |

Variabele (geen secret): `API_BASE_URL` = `https://codex.nordinkole.nl`. Wordt in de Windows-build als
`VITE_API_BASE_URL` ingebakken. Zonder variabele wordt dat domein als standaard gebruikt.

Maak in GitHub een environment `production` aan (deploy.yml gebruikt die); daar kun je optioneel een
handmatige goedkeuring voor deploys instellen.

### SSH-sleutel voor deploy

```bash
ssh-keygen -t ed25519 -C "codex-deploy" -f codex-deploy -N ""
ssh-copy-id -i codex-deploy.pub gebruiker@vps      # of de .pub-inhoud in ~/.ssh/authorized_keys plakken
# inhoud van codex-deploy (privé) → secret DEPLOY_SSH_KEY
```

### Tauri-updater sleutelpaar (eenmalig)

```bash
cd frontend
npx tauri signer generate -w ~/.tauri/codex.key
```

- Privé-sleutel (`~/.tauri/codex.key`) → secret `TAURI_SIGNING_PRIVATE_KEY`. Nooit in de repo.
- Publieke sleutel (`~/.tauri/codex.key.pub`) → plakken in `src-tauri/tauri.conf.json` bij
  `plugins.updater.pubkey` in plaats van `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`. Die mag in git.

Zonder geldige publieke sleutel faalt de updatecontrole stil (de app werkt gewoon, zonder melding).
Verlies je de privé-sleutel, dan kunnen bestaande installaties nooit meer automatisch updaten;
gebruikers moeten dan één keer handmatig een nieuwe installer draaien.

### Android keystore

De bestaande `codex.keystore` in de projectroot staat niet in git (`*.keystore` in `.gitignore`) en hoort
daar ook niet. Zet hem base64 in het secret:

```bash
base64 -w0 codex.keystore        # macOS: base64 -i codex.keystore
```

Gebruik dezelfde keystore als waarmee de huidige app op je telefoon is ondertekend, anders weigert
Android een update over de bestaande installatie heen. Bewaar de keystore en wachtwoorden ook buiten CI.

## Server (Vimexx VPS)

Bestaande opzet blijft: host-Apache termineert TLS en proxyt naar Caddy op `127.0.0.1:8082`
(`deploy/apache/codex.nordinkole.nl.conf`), Caddy serveert `frontend/dist` en proxyt `/api` naar de
PHP-container (`docker-compose.prod.yml`). De database staat in het Docker-volume `sqlite_data`.

### Eenmalige voorbereiding

1. De code op de server staat in `~/codex`. Dat mag een normale clone zijn (`git clone ... ~/codex`) of de
   bestaande combinatie van bare repo `~/repos/codex.git` plus work tree; `deploy/deploy.sh` herkent beide.
   Met een normale clone werkt de SSH-deploy het eenvoudigst (`git fetch` en `git checkout`).
2. `~/codex/.env.production` bevat de secrets (zie `backend/.env.production.example`). Voeg toe:
   `RELEASE_REPO=nordindutch/lifedashboard` zodat `/api/version` de downloadlinks kent.
3. Node 20+ en Docker Compose v2 op de server (nodig voor de frontend-build; dat was al zo).
4. Test handmatig: `cd ~/codex && ./deploy/deploy.sh`.

### Wat deploy/deploy.sh doet

1. Code bijwerken (of al gedaan door de workflow) en `backend/BUILD` schrijven met de git-sha.
2. Frontend bouwen.
3. **Back-up** van `codex.sqlite` via `VACUUM INTO` naar `~/db-backups/codex-<datum>-<sha>.sqlite`
   (laatste 20 bewaard).
4. Containers bouwen en starten.
5. Migratiescripts in het volume kopiëren, `mark_existing_migrations.php`, `migrate.php`.
6. **Healthcheck**: `GET /api/health` moet `"status":"ok"` geven (database leesbaar).
7. **Rollback** bij een mislukte migratie of healthcheck: database terug uit de back-up, vorige commit
   uitchecken, frontend bouwen, containers herstarten en opnieuw controleren. Het script eindigt dan met
   exit 1, zodat de workflow rood wordt.

Handmatig terugzetten van een back-up:

```bash
cd ~/codex
docker compose -f docker-compose.prod.yml cp ~/db-backups/codex-XXXX.sqlite php:/tmp/restore.sqlite
docker compose -f docker-compose.prod.yml exec -T php sh -c 'rm -f /var/www/html/database/codex.sqlite*; mv /tmp/restore.sqlite /var/www/html/database/codex.sqlite; chown www-data:www-data /var/www/html/database/codex.sqlite'
```

Deploys mogen niet tegelijk lopen; de workflow heeft daarvoor een `concurrency`-groep.

## Desktop (Windows, Tauri 2)

- `tauri.conf.json` > `plugins.updater`: endpoint
  `https://github.com/nordindutch/lifedashboard/releases/latest/download/latest.json`,
  `installMode: passive` (installer met voortgangsbalk, geen vragen).
- `bundle.createUpdaterArtifacts: true` zorgt voor `.sig`-bestanden; `tauri-action` maakt `latest.json`.
- Bij het opstarten (`UpdateBanner`) controleert de app op een nieuwe versie en toont: "Versie X is
  beschikbaar (je gebruikt Y). De app wordt na het bijwerken opnieuw gestart." met de knop **Nu bijwerken**.
  Sluiten onthoudt de keuze voor deze sessie.
- Rust-afhankelijkheden `tauri-plugin-updater` en `tauri-plugin-process` staan in `Cargo.toml` en
  `Cargo.lock`; capabilities `updater:default`, `process:default` en `process:allow-restart` in
  `src-tauri/capabilities/default.json`.
- Lokaal bouwen: `cd frontend && npm run tauri:build` (vereist Rust en de Windows-buildtools).

## Android (Capacitor 8)

### Keuze: in-app updatecontrole met downloadlink (gekozen)

De app laadt de web-UI live van `https://codex.nordinkole.nl` (`capacitor.config.ts` > `server.url`).
Elke deploy van de web-UI is dus direct zichtbaar in de app zonder nieuwe APK. Alleen de native schil
(plugins, Android-versie, icoon) heeft een nieuwe APK nodig. Daarom:

- Bij het opstarten vergelijkt de app zijn `versionCode` (via `@capacitor/app`) met
  `/api/version` > `android.version_code`. Is de server nieuwer, dan verschijnt een banner met
  **Download** naar `codex-android.apk` van de laatste GitHub Release.
- Installatie is sideload: Android vraagt eenmalig toestemming om apps uit die bron te installeren. Omdat
  de APK met dezelfde keystore is ondertekend, gaat de update over de bestaande installatie heen en blijven
  gegevens (sessie) bewaard.

Voordelen: geen Google Play-account of reviewproces, geen extra dienst, werkt vandaag. De
web-inhoud is sowieso live.
Nadelen: een update van de native schil is een handmatige tik plus installatie; geen automatische
installatie op de achtergrond; de APK-link is publiek (de app zelf is zonder inlog onbruikbaar).

### Alternatieven, niet gekozen

- **Live-updates van web-assets** (Capgo, Ionic Appflow): overbodig omdat de app al de live server
  laadt; voegt een betaalde of zelfgehoste dienst toe en lost het native-schil-probleem niet op.
- **Google Play (interne test of productie)**: automatische updates via de Play Store en geen
  sideload-waarschuwing, maar vereist een ontwikkelaarsaccount (eenmalig 25 dollar), een reviewproces en
  een vaste upload-keystore. De AAB wordt al gebouwd, dus dit is later toe te voegen zonder de pipeline te
  veranderen (bijvoorbeeld met `r0adkll/upload-google-play` in `release.yml`).

### Lokaal een APK bouwen

```bash
cd frontend && npm run build:android && cd ..
npx cap sync android
export CODEX_KEYSTORE_FILE=$PWD/codex.keystore CODEX_KEYSTORE_PASSWORD=... CODEX_KEY_ALIAS=... CODEX_KEY_PASSWORD=...
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

## Controleren of het werkt

- `curl https://codex.nordinkole.nl/api/version` geeft de versie, build en downloadlinks.
- `curl https://codex.nordinkole.nl/api/health` geeft `"status":"ok"`.
- Instellingen > Over Codex toont app- en serverversie.
- GitHub > Actions: CI groen op main, Release groen op de tag, Deploy groen daarna.

## Handmatige noodprocedure

Als GitHub niet beschikbaar is: `ssh gebruiker@vps`, `cd ~/codex`, `git pull`, `./deploy/deploy.sh`.
Het script doet dezelfde back-up, migraties en healthcheck als de workflow.
