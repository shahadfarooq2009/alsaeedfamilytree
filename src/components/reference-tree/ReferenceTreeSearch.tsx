import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PersonSummary } from '../../types/person';
import { listFamilyPeople } from '../../services/personService';
import { IconSearch } from './referenceTreeIcons';

interface ReferenceTreeSearchProps {
  familyId: number;
  highlightIds: number[];
  onSelect: (person: PersonSummary) => void;
  onEnter: (query: string, results: PersonSummary[]) => void;
  onQueryClear?: () => void;
}

export function ReferenceTreeSearch({
  familyId,
  highlightIds,
  onSelect,
  onEnter,
  onQueryClear,
}: ReferenceTreeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const skipNextQueryClearRef = useRef(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setResultsOpen(false);
      if (skipNextQueryClearRef.current) {
        skipNextQueryClearRef.current = false;
        return;
      }
      onQueryClear?.();
      return;
    }

    setResultsOpen(true);

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
  }, [familyId, onQueryClear, query]);

  const handleEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !query.trim()) return;
    event.preventDefault();
    onEnter(query.trim(), results);
    setResultsOpen(false);
  };

  return (
    <div className="tree-header-search-wrap">
      <div className="tree-header-search">
        <IconSearch />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleEnter}
          placeholder="ابحث عن اسم..."
          autoComplete="off"
        />
      </div>

      {(loading || results.length > 0) && query.trim() && resultsOpen && (
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
                  skipNextQueryClearRef.current = true;
                  onSelect(person);
                  setQuery('');
                  setResults([]);
                  setResultsOpen(false);
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
