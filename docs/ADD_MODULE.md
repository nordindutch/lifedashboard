# Een nieuwe module toevoegen

Project Codex is opgebouwd uit modules (budget, taken, notities, dagboek, start, instellingen).
Een module heeft een frontend-deel (`frontend/src/modules/<naam>/`) en optioneel een
backend-deel (`backend/src/Modules/<Naam>/`). Kernbestanden hoef je niet aan te passen,
behalve twee registratielijsten.

De module `hello` in de repo is het minimale voorbeeld. Hij staat achter een feature flag
en is alleen zichtbaar met `VITE_FLAG_HELLO=true` in de frontend-omgeving.

## Overzicht

| Laag | Bestand | Doel |
| --- | --- | --- |
| Frontend | `frontend/src/modules/<naam>/manifest.ts` | Id, label, icoon, routes, navigatie, volgorde, feature flag |
| Frontend | `frontend/src/modules/<naam>/pages/*.tsx` | Lazy geladen pagina's |
| Frontend | `frontend/src/modules/<naam>/api/*.ts`, `hooks/*.ts`, `components/*.tsx` | Module-eigen code |
| Frontend | `frontend/src/modules/registry.ts` | Lijst `ALL_MODULES` (hier je manifest toevoegen) |
| Backend | `backend/src/Modules/<Naam>/<Naam>Module.php` | Routes en migratiemap |
| Backend | `backend/src/Modules/<Naam>/*Controller.php` | Controllers (mogen ook in `src/Controllers` staan) |
| Backend | `backend/src/Modules/<Naam>/migrations/NNN_naam.sql` | Migraties van de module |
| Backend | `backend/src/Modules/modules.php` | Lijst van moduleklassen (hier je klasse toevoegen) |

De registry bouwt uit de manifesten: de routes in `App.tsx`, de mobiele tabbalk (`BottomNav`),
de desktop-zijbalk (`Sidebar`), het scherm "Meer" (`MorePage`) en de lijst in Instellingen
waarmee een gebruiker modules aan of uit zet.

## Stappenplan

### 1. Frontend-manifest

Maak `frontend/src/modules/voeding/manifest.ts`:

```ts
import { Apple } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const voedingModule: ModuleManifest = {
  id: 'voeding',                 // stabiel, ook gebruikt in de instelling disabled_modules
  label: 'Voeding',
  icon: Apple,
  description: 'Maaltijden en calorieën bijhouden.',
  order: 25,                     // positie tussen de andere modules
  // featureFlag: 'VOEDING',     // optioneel: alleen tonen met VITE_FLAG_VOEDING=true
  routes: [
    { path: '/voeding', component: lazy(() => import('./pages/VoedingPage').then((m) => ({ default: m.VoedingPage }))) },
    { path: '/voeding/:date', component: lazy(() => import('./pages/VoedingDayPage').then((m) => ({ default: m.VoedingDayPage }))) },
  ],
  nav: [
    // placement: 'primary' (tabbalk + bovenin zijbalk), 'secondary' (zijbalk onder de streep, mobiel onder Meer)
    // of 'more' (alleen onder Meer en onderaan de zijbalk)
    { id: 'voeding', label: 'Voeding', icon: Apple, path: '/voeding', placement: 'secondary', order: 25 },
  ],
};
```

Regels voor `nav`:

- Een module mag meerdere navigatie-items hebben (budget heeft Maand, Rekeningen en Analyse).
- `exact: true` markeert alleen het exacte pad als actief; standaard telt elk pad dat met `path` begint.
- Houd de tabbalk op mobiel klein: maximaal drie of vier primaire items plus "Meer".

### 2. Pagina's en module-eigen code

Zet pagina's in `frontend/src/modules/voeding/pages/`, API-aanroepen in `api/`, hooks in `hooks/` en
componenten in `components/`. Gebruik de gedeelde bouwstenen uit `frontend/src/components/ui/` en de
tokens uit `tailwind.config.ts` (`bg-codex-surface`, `text-codex-muted`, `rounded-card`, `min-h-touch`).
Interface-teksten zijn Nederlands, zonder em-dashes.

### 3. Registreren in de frontend

Voeg het manifest toe aan `ALL_MODULES` in `frontend/src/modules/registry.ts`. Dat is de enige
wijziging buiten je modulemap.

### 4. Backend-module

Maak `backend/src/Modules/Voeding/VoedingModule.php`:

```php
<?php

declare(strict_types=1);

namespace Codex\Modules\Voeding;

use Codex\Core\AbstractModule;
use Codex\Core\Request;
use Codex\Core\Router;

final class VoedingModule extends AbstractModule
{
    public function id(): string
    {
        return 'voeding';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__); // <ModuleDir>/migrations
    }

    public function registerRoutes(Router $router): void
    {
        // lazy(): controller pas maken bij het eerste verzoek (geen 500 als de DB nog niet gemigreerd is)
        $meals = $this->lazy(static fn (): MealController => new MealController());

        $router->get('/api/voeding/meals', static fn (Request $r) => $meals()->index($r));
        $router->post('/api/voeding/meals', static fn (Request $r) => $meals()->store($r));
    }

    // Optioneel: paden zonder sessie-auth
    // public function publicPaths(): array { return ['/api/voeding/public']; }
}
```

Controllers volgen de bestaande conventies: valideren, repository of service aanroepen,
`Response::success()` of `Response::error()` teruggeven. Alle SQL met prepared statements.

### 5. Migraties

Zet SQL-bestanden in `backend/src/Modules/Voeding/migrations/`, bijvoorbeeld `012_voeding_meals.sql`.

- Het nummer moet uniek zijn over de hele repo (kernmap plus alle modules). `php database/migrate.php --list`
  toont alle bekende migraties met status; een dubbele naam breekt de migratie met een duidelijke fout.
- Gebruik `CREATE TABLE IF NOT EXISTS` en `CREATE INDEX IF NOT EXISTS`. `ALTER TABLE ADD COLUMN` kan niet
  idempotent, dus controleer eerst of de kolom al bestaat.
- Nooit een al toegepaste migratie wijzigen. Schrijf een nieuwe.
- `PRAGMA journal_mode` en `PRAGMA synchronous` worden door migrate.php buiten de transactie uitgevoerd.

Test lokaal tegen een lege database:

```bash
cd backend
CODEX_DB_PATH=/tmp/codex-test.sqlite php database/migrate.php --dry-run
CODEX_DB_PATH=/tmp/codex-test.sqlite php database/migrate.php
```

### 6. Registreren in de backend

Voeg `Codex\Modules\Voeding\VoedingModule::class` toe aan `backend/src/Modules/modules.php`.

### 7. Tests

- Backend: `backend/tests/Modules/Voeding/*Test.php` (PHPUnit, in-memory of tijdelijke SQLite via `CODEX_DB_PATH`).
  Draai met `cd backend && composer install && composer test`.
- Frontend: rekenlogica als pure functies in `lib/` met een `*.test.ts` ernaast. Draai met `cd frontend && npm test`.

### 8. Controlelijst voor je commit

```bash
cd frontend && npm run build       # typecheck + Vite build
cd backend && composer test        # PHP-tests
php backend/database/migrate.php --dry-run
```

## Modules aan of uit per gebruiker

Instellingen toont elke beschikbare module met een schakelaar. De keuze staat in de instelling
`disabled_modules` (JSON-lijst van module-id's, zie migratie `010_module_settings.sql`). Modules met
`core: true` (budget, instellingen) zijn altijd aan. Een uitgeschakelde module verdwijnt uit navigatie en
routes; de backend-routes blijven bestaan en de gegevens blijven bewaard.

## Feature flags

Zet `featureFlag: 'NAAM'` in het manifest en bouw met `VITE_FLAG_NAAM=true` om de module te tonen.
Zonder die variabele bestaat de module niet in de build. Handig voor werk in uitvoering.
