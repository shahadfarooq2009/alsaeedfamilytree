<?php

namespace App\Console\Commands;

use App\Services\PersonPruningService;
use Illuminate\Console\Command;

class PrunePeopleFromGeneration extends Command
{
    protected $signature = 'people:prune-from-generation
                            {--from=3 : Delete people at this generation and above}
                            {--family= : Limit deletion to one family id}
                            {--force : Run without confirmation}';

    protected $description = 'Delete all people from a generation upward (deepest first), including relationships.';

    public function handle(PersonPruningService $pruningService): int
    {
        $fromGeneration = max(2, (int) $this->option('from'));
        $familyId = $this->option('family');
        $familyId = $familyId !== null && $familyId !== '' ? (int) $familyId : null;

        $this->warn("Deleting all people with generation_number >= {$fromGeneration}"
            .($familyId ? " in family #{$familyId}" : ' across all families').'...');

        if (! $this->option('force') && ! $this->confirm('This cannot be undone. Continue?', true)) {
            $this->info('Cancelled.');

            return self::SUCCESS;
        }

        $result = $pruningService->pruneFromGeneration($fromGeneration, $familyId);

        $this->info("Deleted {$result['deleted']} people.");

        foreach ($result['families'] as $id => $count) {
            $this->line("  Family #{$id}: {$count}");
        }

        return self::SUCCESS;
    }
}
