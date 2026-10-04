# Beslissingen en aannames

Korte log van keuzes die tijdens het herontwerp van de Budget-module en de modulaire opzet zijn gemaakt.
Nieuwste bovenaan.

## Modulaire opzet (fase 1)

- **Start (dagelijkse briefing) blijft bestaan, maar onder "Meer".** Het ontwerp noemt Start niet; weggooien
  zou functionaliteit kosten. De route is `/home`, de app opent op `/budget`.
- **Breakpoint md is 720 px** (was 768 px, Tailwind-standaard). De stijlgids vraagt om de mobiele indeling
  onder 720 px. Dit geldt app-breed, zodat de schil (tabbalk versus zijbalk) en de pagina's hetzelfde
  omslagpunt gebruiken.
- **Manrope wordt meegeleverd** via het npm-pakket `@fontsource-variable/manrope` in plaats van Google Fonts,
  zodat de desktop-app en de Android-app het lettertype ook zonder netwerk hebben.
- **Oude kleurnamen blijven werken.** `codex-bg`, `codex-surface`, `codex-border`, `codex-accent` en
  `codex-muted` wijzen nu naar CSS-variabelen met de nieuwe waarden. Bestaande pagina's (taken, notities,
  dagboek) krijgen daarmee automatisch het nieuwe accent (#F2B84B) in plaats van indigo.
- **Modules aan/uit per gebruiker** is gebouwd omdat het weinig werk bleek: één instelling
  `disabled_modules` (JSON) plus een kaart in Instellingen. Kernmodules (budget, instellingen) kunnen niet uit.
- **Migraties per module** liggen in `backend/src/Modules/<Naam>/migrations/`. `migrate.php` sorteert alle
  migraties op bestandsnaam, dus nummers moeten uniek zijn over de hele repo. De CLI weigert dubbele namen.
- **Bugfix in migrate.php**: een verse installatie faalde op `PRAGMA journal_mode` binnen een transactie.
  Die regels (en `PRAGMA synchronous`) worden nu buiten de transactie uitgevoerd. Bestaande migraties zijn
  niet aangepast.
- **CODEX_DB_PATH** overschrijft het pad naar codex.sqlite (tests en CI). Zonder die variabele verandert er niets.
- **De voorbeeldmodule hello** zit achter de feature flag `VITE_FLAG_HELLO` en heeft een voorbeeldmigratie met
  de extensie `.sql.example`, zodat productie geen hello-tabel krijgt.
- **Sidebar start uitgeklapt** (240 px, zoals het desktopontwerp). De gebruiker kan hem nog steeds inklappen.

## Budget herbouw (fase 2)

- **Rente op schulden telt alleen mee in de huidige en toekomstige maanden.** Archiefmaanden zijn historie; de
  rente van vandaag hoort daar niet in. Opgenomen in `summary.interest_items` en `summary.total_interest`, en
  meegerekend in `pending_expenses`, `total_expenses` en `projected_balance`. De analyse (per categorie over
  twaalf maanden) leest nog steeds alleen `budget_expenses`; rente verschijnt daar als aparte regel voor de
  huidige maand.
- **Aflossingen worden gelogd** in `budget_debt_payments` (migratie 012) en verhogen `paid_amount`. Zo blijft
  het bestaande datamodel (amount, paid_amount, paid) intact en is er historie op het schuld-detailscherm.
- **"Kopieer vorige maand" neemt ook het minimumsaldo en de gekoppelde betaalrekening over**, maar alleen als de
  nieuwe maand nog de standaardwaarden heeft. Eerder begon elke nieuwe maand met minimum -2400.
- **Gekozen maand staat in de URL** (`/budget?m=2026-09`), zodat terugnavigeren en delen werken en Rekeningen
  en Analyse geen maandstatus hoeven te delen.
- **Saldo en minimum wijzigen** zit achter een tik op het saldo (lade "Saldo en minimum"). Het ontwerp toont
  dat scherm niet, maar de koppeling met een betaalrekening en het minimum moesten bereikbaar blijven.
- **Analyse gebruikt geen recharts meer**; balken zijn gewone elementen met aria-labels. Het pakket `recharts`
  wordt nergens meer gebruikt en kan in een vervolgstap uit package.json.
- **Het oude pilletje "Snel toevoegen" (taak of afspraak)** staat op mobiel alleen nog op Start en Taken, zodat
  het de plusknop van Budget niet overlapt. Op desktop blijft het in de zijbalk.
- **Afvinken is optimistisch**: de cache wordt direct bijgewerkt met dezelfde rekenregels als de server
  (`recomputeSummary`), met terugdraaien bij een fout en een herlaad na afloop.
- **Breakpoint voor de desktopindeling** is dezelfde 720 px als de schil (`useIsDesktop`).

## Deployment en updates (fase 3)

- **Versiebron is de root package.json.** `scripts/sync-version.mjs` schrijft hem overal heen; CI controleert
  dat met `--check`. Android `versionCode` = major x 10000 + minor x 100 + patch, zodat hij altijd stijgt en
  rechtstreeks uit de versie af te leiden is (ook door `/api/version`).
- **Android versionCode springt van 1 naar 200** (versie 0.2.0). Dat is toegestaan: hoger is genoeg.
- **Deploy via SSH vanuit GitHub Actions** in plaats van een pull-gebaseerde cron op de server. Dat geeft
  directe feedback (rode run bij een mislukte migratie) en één plek voor de logs. Het script werkt ook
  handmatig op de server.
- **Rollback herstelt de database uit de back-up van vlak vóór de migratie** en checkt de vorige commit uit.
  Migraties blijven forward-only (zoals de bestaande regels); de rollback is een noodrem, geen down-migratie.
- **`/api/version` en `/api/health` zijn publiek** (geen sessie). Ze lekken alleen het versienummer en of de
  database bereikbaar is; dat is nodig voor de healthcheck van het deploy-script en de updatecontrole vóór
  het inloggen.
- **Desktop-updater met passieve installatie** (`installMode: passive`): de installer toont voortgang maar
  stelt geen vragen. De melding zelf staat in de app in het Nederlands; de controle gebeurt 2,5 seconde na het
  opstarten, zodat die nooit het inloggen vertraagt, en fouten (geen netwerk, geen sleutel) worden stil
  overgeslagen.
- **Publieke updater-sleutel is een placeholder** (`REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`). De privé-sleutel
  moet door de eigenaar worden gegenereerd en mag nooit in de repo; daarom is hij hier niet aangemaakt.
- **Android: in-app updatecontrole met downloadlink**, geen live-updates. Zie docs/DEPLOYMENT.md voor de
  afweging; kern: de app laadt de web-UI al live van de server.
- **Release op tag, deploy op main.** Kleine web-wijzigingen hoeven geen apps te bouwen. De release-workflow
  roept na de web-build dezelfde deploy-workflow aan, zodat de server op de getagde versie komt.
- **Vite staat nu expliciet in devDependencies** (was alleen transitief), zodat `npm run build` in CI en lokaal
  dezelfde versie gebruikt.
