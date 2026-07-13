import { useEffect, useState } from 'react';
import type { PersonSummary } from '../../types/person';
import { listFamilyPeople } from '../../services/personService';
import { botanicalTheme } from '../../theme/botanicalTree';

interface TreeSearchProps {
  familyId: number;
  onSelect: (person: PersonSummary) => void;
}

export function TreeSearch({ familyId, onSelect }: TreeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await listFamilyPeople(familyId, {
          search: query.trim(),
          per_page: 8,
        });
        setResults(response.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [familyId, query]);

  return (
    <div className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث بالاسم العربي..."
        className="w-full rounded-full border-0 bg-transparent px-2 py-2.5 text-[#2f3628] outline-none placeholder:text-[#8a8478] focus:ring-0 md:py-2.5"
        dir="rtl"
      />

      {(loading || results.length > 0) && query.trim() && (
        <ul
          className="absolute z-40 mt-2 max-h-64 w-full overflow-auto rounded-xl border bg-white/95 shadow-xl backdrop-blur-md"
          style={{ borderColor: botanicalTheme.colors.glassBorder }}
        >
          {loading && (
            <li className="px-4 py-3 text-sm text-[#5c6652]">جاري البحث...</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-[#5c6652]">لا توجد نتائج</li>
          )}
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(person);
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full flex-col items-start px-4 py-3 text-right transition hover:bg-[#f7f2e4]"
              >
                <span className="font-medium text-[#2f3628]">{person.full_name}</span>
                <span className="text-xs text-[#5c6652]">
                  {person.father?.full_name ? `ابن ${person.father.full_name}` : 'بدون أب مسجل'}
                  {' • '}الجيل {person.generation_number}
                  {person.birth_date ? ` • ${person.birth_date.slice(0, 4)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
