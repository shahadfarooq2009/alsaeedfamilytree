import { useCallback, useEffect, useState } from 'react';
import type { ParentCandidate } from '../types/person';
import { searchParentCandidates } from '../services/personService';

interface UseParentSearchOptions {
  familyId: number;
  gender?: 'male' | 'female';
  excludePersonId?: number;
}

export function useParentSearch({
  familyId,
  gender,
  excludePersonId,
}: UseParentSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParentCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);

      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await searchParentCandidates(familyId, {
          search: searchQuery,
          gender,
          exclude_person_id: excludePersonId,
          limit: 10,
        });
        setResults(response.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [familyId, gender, excludePersonId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim()) {
        void search(query);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    loading,
    search,
    clear: () => {
      setQuery('');
      setResults([]);
    },
  };
}
