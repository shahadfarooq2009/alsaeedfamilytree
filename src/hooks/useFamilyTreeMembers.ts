import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { fetchFamilyTreeBundle } from '../services/familyTreeDataService';
import type { PersonSummary } from '../types/person';
import type { FamilyMemberInput } from '../utils/treeLayout/types';
import {
  parseRequestedFamilyId,
  resolveAccessibleFamilyId,
} from '../utils/resolveAccessibleFamilyId';
import { getCachedFamilyTreeBundle } from '../utils/familyTreeCache';
import { toApiError } from '../lib/api';

export function useFamilyTreeMembers() {
  const { familyId: routeFamilyId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedFamilyId = useMemo(
    () => parseRequestedFamilyId(routeFamilyId, searchParams.get('family_id')),
    [routeFamilyId, searchParams],
  );

  const [familyId, setFamilyId] = useState<number | null>(null);
  const familyIdRef = useRef<number | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [founderPersonId, setFounderPersonId] = useState<number | null>(null);
  const [members, setMembers] = useState<FamilyMemberInput[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const applyBundle = useCallback((bundle: {
    family: { name: string; founder_person_id?: number | null };
    members: FamilyMemberInput[];
    people?: PersonSummary[];
  }, cached: boolean) => {
    setFamilyName(bundle.family.name);
    setFounderPersonId(bundle.family.founder_person_id ?? null);
    setMembers(bundle.members);
    setPeople(bundle.people ?? []);
    setFromCache(cached);
  }, []);

  const loadTree = useCallback(async (options: { silent?: boolean; bypassCache?: boolean } = {}) => {
    const { silent = false, bypassCache = false } = options;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const resolvedFamilyId = await resolveAccessibleFamilyId(requestedFamilyId);

      if (familyIdRef.current !== resolvedFamilyId) {
        familyIdRef.current = resolvedFamilyId;
        setFamilyId(resolvedFamilyId);
      }

      if (!bypassCache) {
        const cached = getCachedFamilyTreeBundle(resolvedFamilyId);
        if (cached) {
          applyBundle(cached, true);
          if (!silent) {
            setLoading(false);
          }
        }
      }

      const bundle = await fetchFamilyTreeBundle(resolvedFamilyId, { bypassCache: true });
      applyBundle(bundle, false);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applyBundle, requestedFamilyId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const refreshTree = useCallback(async () => {
    await loadTree({ silent: true, bypassCache: true });
  }, [loadTree]);

  return {
    familyId,
    familyName,
    founderPersonId,
    members,
    people,
    loading,
    error,
    fromCache,
    refreshTree,
  };
}
