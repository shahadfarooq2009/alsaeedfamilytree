<?php

namespace App\Console\Commands;

use App\Models\Family;
use App\Services\PersonGenerationService;
use Illuminate\Console\Command;

class RecalculatePeopleGenerations extends Command
{
    protected $signature = 'people:recalculate-generations
                            {--family= : Limit recalculation to one family id}';

    protected $description = 'Recalculate generation_number for all people from parent links.';

    public function handle(PersonGenerationService $generationService): int
    {
        $familyId = $this->option('family');
        $familyId = $familyId !== null && $familyId !== '' ? (int) $familyId : null;

        $families = $familyId
            ? Family::query()->whereKey($familyId)->get()
            : Family::query()->orderBy('id')->get();

        if ($families->isEmpty()) {
            $this->warn('No families found.');

            return self::SUCCESS;
        }

        $totalUpdated = 0;

        foreach ($families as $family) {
            $updated = $generationService->recalculateFamily((int) $family->id);
            $totalUpdated += $updated;
            $this->line("Family #{$family->id} ({$family->name}): updated {$updated} people.");
        }

        $this->info("Done. Updated {$totalUpdated} people in total.");

        return self::SUCCESS;
    }
}
