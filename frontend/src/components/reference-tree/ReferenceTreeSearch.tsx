import { useEffect, useState } from 'react';
import type { PersonSummary } from '../../types/person';
import { listFamilyPeople } from '../../services/personService';
import { IconSearch } from './referenceTreeIcons';

interface ReferenceTreeSearchProps {
  familyId: number;
  highlightIds: number[];
  onResultsChange: (results: PersonSummary[]) => void;
  onSelect: (person: PersonSummary) => void;
}

export function ReferenceTreeSearch({
  familyId,
  highlightIds,
  onResultsChange,
  onSelect,
}: ReferenceTreeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      onResultsChange([]);
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
        onResultsChange(response.data);
      } catch {
        setResults([]);
        onResultsChange([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [familyId, query, onResultsChange]);

  return (
    <div className="tree-header-search-wrap">
      <div className="tree-header-search">
        <IconSearch />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن اسم..."
          autoComplete="off"
        />
      </div>

      {(loading || results.length > 0) && query.trim() && (
        <ul className="tree-header-search-results">
          {loading && <li className="tree-header-search-empty">جاري البحث...</li>}
          {!loading && results.length === 0 && (
            <li className="tree-header-search-empty">لا توجد نتائج</li>
          )}
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className={highlightIds.includes(person.id) ? 'search-hit' : undefined}
                onClick={() => {
                  onSelect(person);
                  setQuery('');
                  setResults([]);
                  onResultsChange([]);
                }}
              >
                <span className="tree-header-search-name">{person.full_name}</span>
                <span className="tree-header-search-meta">
                  {person.father?.full_name ? `ابن ${person.father.full_name}` : 'بدون أب مسجل'}
                  {' • '}الجيل {person.generation_number}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
