<?php

declare(strict_types=1);

/**
 * Geregistreerde backend-modules, in volgorde van route-registratie.
 * Een nieuwe module toevoegen: klasse aanmaken in src/Modules/<Naam>/<Naam>Module.php en hier opnemen.
 */
return [
    Codex\Modules\Core\CoreModule::class,
    Codex\Modules\Budget\BudgetModule::class,
    Codex\Modules\Tasks\TasksModule::class,
    Codex\Modules\Notes\NotesModule::class,
    Codex\Modules\Diary\DiaryModule::class,
    Codex\Modules\Hello\HelloModule::class,
];
