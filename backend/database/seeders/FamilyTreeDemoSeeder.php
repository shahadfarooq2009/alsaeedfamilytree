<?php

namespace Database\Seeders;

use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Seeder;
use InvalidArgumentException;

class FamilyTreeDemoSeeder extends Seeder
{
    private const FAMILY_NAME = 'عائلة الفاروق — بيانات تجريبية';

    private const DEMO_MARKER = 'DEMO_FAMILY_TREE_REFERENCE';

    private const SECTOR_COUNT = 3;

    private const PILLAR_NAMES = ['محمد', 'أحمد', 'عبدالله'];

    private const MALE_FIRST_NAMES = [
        'أحمد', 'علي', 'حسن', 'حسين', 'سلمان', 'جاسم', 'ناصر', 'راشد', 'سعود', 'عمر',
        'بدر', 'منصور', 'فهد', 'طلال', 'نواف', 'جلال', 'فاروق', 'إبراهيم', 'محمود', 'حمد',
        'خليفة', 'عيسى', 'يعقوب', 'عبدالوهاب', 'عبدالرحمن', 'سالم', 'ماجد', 'زياد', 'وليد', 'كريم',
    ];

    private const FEMALE_FIRST_NAMES = [
        'فاطمة', 'مريم', 'زينب', 'شريفة', 'شهد', 'نورة', 'حصة', 'دانة', 'سارة', 'آمنة',
        'خديجة', 'ليلى', 'ريم', 'هدى', 'منيرة', 'لطيفة', 'نوال', 'أمل', 'ابتسام', 'حنان',
        'جميلة', 'نبيلة', 'رقية', 'زهراء', 'سمية', 'هيفاء', 'نجلاء', 'سلمى', 'غادة', 'ديمة',
    ];

    private Family $family;

    private ?int $createdBy = null;

    private int $maleNameIndex = 0;

    private int $femaleNameIndex = 0;

    public function run(): void
    {
        $this->createdBy = User::query()->value('id');
        $this->family = $this->resolveDemoFamily();
        $this->grantDemoFamilyAccess();

        Person::query()->where('family_id', $this->family->id)->delete();

        $this->seedReference81Tree();

        $this->validateAndReport();
    }

    private function resolveDemoFamily(): Family
    {
        return Family::updateOrCreate(
            ['name' => self::FAMILY_NAME],
            [
                'description' => self::DEMO_MARKER.' — fictional reference-layout data',
                'created_by' => $this->createdBy,
            ]
        );
    }

    private function grantDemoFamilyAccess(): void
    {
        $users = User::query()
            ->whereIn('email', ['meshoosha88@gmail.com', 'admin@familytree.test'])
            ->get();

        if ($users->isEmpty() && $this->createdBy !== null) {
            $users = User::query()->whereKey($this->createdBy)->get();
        }

        foreach ($users as $user) {
            FamilyMembership::updateOrCreate(
                [
                    'family_id' => $this->family->id,
                    'user_id' => $user->id,
                ],
                ['role' => 'owner']
            );
        }
    }

    private function seedReference81Tree(): void
    {
        $founder = $this->seedFounder();
        $this->family->update(['founder_person_id' => $founder->id]);

        $gen2 = [];
        foreach (self::PILLAR_NAMES as $index => $branchName) {
            $gen2[] = $this->createDemoPerson([
                'full_name' => $branchName,
                'first_name' => $branchName,
                'middle_name' => 'الفاروق',
                'last_name' => 'الفاروق',
                'gender' => 'male',
                'birth_date' => date('Y-m-d', strtotime("1970-01-01 +{$index} years")),
                'generation_number' => 2,
                'father_id' => $founder->id,
            ]);
        }
    }

    /**
     * @param  list<Person>  $parents
     * @param  list<int>  $countsPerParent
     * @return list<Person>
     */
    private function seedChildrenForParents(
        array $parents,
        int $generation,
        array $countsPerParent,
        string $startDate,
    ): array {
        $members = [];
        $total = array_sum($countsPerParent);
        $birthDates = $this->spreadDates($startDate, $total, 8);
        $dateIndex = 0;

        foreach ($parents as $parentIndex => $parent) {
            $count = $countsPerParent[$parentIndex] ?? 0;
            for ($childIndex = 0; $childIndex < $count; $childIndex++) {
                $gender = ($dateIndex % 3 === 1) ? 'female' : 'male';
                $firstName = $this->nextFirstName($gender, $parentIndex, $childIndex + $generation);
                $members[] = $this->createDemoPerson([
                    'full_name' => $firstName,
                    'first_name' => $firstName,
                    'middle_name' => $parent->first_name,
                    'last_name' => 'الفاروق',
                    'gender' => $gender,
                    'birth_date' => $birthDates[$dateIndex],
                    'generation_number' => $generation,
                    'father_id' => $parent->id,
                ]);
                $dateIndex++;
            }
        }

        return $members;
    }

    private function createDemoPerson(array $attributes): Person
    {
        return $this->upsertPerson(array_merge([
            'death_date' => null,
            'is_living' => true,
            'is_family_head' => false,
            'mother_id' => null,
            'phone' => null,
            'photo_url' => null,
        ], $attributes));
    }

    private function seedFounder(): Person
    {
        return $this->upsertPerson([
            'full_name' => 'الفاروق',
            'first_name' => 'الفاروق',
            'middle_name' => null,
            'last_name' => 'الفاروق',
            'gender' => 'male',
            'birth_date' => '1935-03-12',
            'death_date' => '2012-08-20',
            'is_living' => false,
            'generation_number' => 1,
            'is_family_head' => true,
            'father_id' => null,
            'mother_id' => null,
            'phone' => null,
            'photo_url' => null,
        ]);
    }

    private function upsertPerson(array $attributes): Person
    {
        if (! isset($attributes['full_name'], $attributes['birth_date'])) {
            throw new InvalidArgumentException('Each demo person requires full_name and birth_date.');
        }

        return Person::updateOrCreate(
            [
                'family_id' => $this->family->id,
                'full_name' => $attributes['full_name'],
                'birth_date' => $attributes['birth_date'],
            ],
            array_merge($attributes, [
                'family_id' => $this->family->id,
                'created_by' => $this->createdBy,
                'privacy_level' => 'family',
            ])
        );
    }

    private function nextFirstName(string $gender, int $branchIndex, int $childIndex): string
    {
        $pool = $gender === 'male' ? self::MALE_FIRST_NAMES : self::FEMALE_FIRST_NAMES;
        $index = ($gender === 'male' ? $this->maleNameIndex : $this->femaleNameIndex);
        $index = ($index + ($branchIndex * 3) + $childIndex) % count($pool);

        if ($gender === 'male') {
            $this->maleNameIndex++;
        } else {
            $this->femaleNameIndex++;
        }

        return $pool[$index];
    }

    /**
     * @return list<string>
     */
    private function spreadDates(string $startDate, int $count, int $yearSpread): array
    {
        $dates = [];
        $start = strtotime($startDate);

        for ($index = 0; $index < $count; $index++) {
            $monthOffset = ($index * 2) % 12;
            $yearOffset = intdiv($index * $yearSpread, max($count - 1, 1));
            $dates[] = date('Y-m-d', strtotime("+{$yearOffset} years +{$monthOffset} months", $start));
        }

        return $dates;
    }

    private function deathDateAfter(string $birthDate, int $year, int $month): string
    {
        return date('Y-m-d', strtotime("{$birthDate} +{$year} years +{$month} months"));
    }

    private function validateAndReport(): void
    {
        $members = Person::query()
            ->where('family_id', $this->family->id)
            ->orderBy('generation_number')
            ->orderBy('id')
            ->get();

        $byGeneration = $members->groupBy('generation_number')->map->count();
        $expectedTotal = 4;

        $this->command?->info('FamilyTreeDemoSeeder finished.');
        $this->command?->info('Demo family: '.self::FAMILY_NAME.' (ID '.$this->family->id.')');
        $this->command?->info('Total demo members: '.$members->count());
        $this->command?->info('Members per generation: '.$this->formatGenerationCounts($byGeneration));

        if ($members->count() !== $expectedTotal) {
            $this->command?->error("Expected exactly {$expectedTotal} demo members.");
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int|string, int>  $byGeneration
     */
    private function formatGenerationCounts($byGeneration): string
    {
        $parts = [];

        foreach ($byGeneration->sortKeys() as $generation => $count) {
            $parts[] = "G{$generation}={$count}";
        }

        return implode(', ', $parts);
    }
}
