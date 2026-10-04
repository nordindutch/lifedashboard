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
