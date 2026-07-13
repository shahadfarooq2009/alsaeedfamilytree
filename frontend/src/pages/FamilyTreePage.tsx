import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { TreePersonNode } from '../types/tree';
import type { FamilyMemberInput } from '../utils/treeLayout/types';

import { ReferenceTreeApp } from '../components/reference-tree/ReferenceTreeApp';

import { getFamily, getFamilyTree, listFamilyPeople } from '../services/personService';
import { mergePeopleIntoHierarchy } from '../utils/normalizeFamilyData';
import {
  parseRequestedFamilyId,
  resolveAccessibleFamilyId,
} from '../utils/resolveAccessibleFamilyId';

import { toApiError } from '../lib/api';

export function FamilyTreePage() {
  const { familyId: routeFamilyId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedFamilyId = useMemo(
    () => parseRequestedFamilyId(routeFamilyId, searchParams.get('family_id')),
    [routeFamilyId, searchParams],
  );

  const [familyId, setFamilyId] = useState<number | null>(null);
  const familyIdRef = useRef<number | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async (silent = false) => {
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

      const [familyResponse, treeResponse, peopleResponse] = await Promise.all([
        getFamily(resolvedFamilyId),
        getFamilyTree(resolvedFamilyId),
        listFamilyPeople(resolvedFamilyId, { per_page: 500 }),
      ]);

      const apiRoots = treeResponse.data as TreePersonNode[];

      setFamilyName(familyResponse.data.name);
      setMembers(mergePeopleIntoHierarchy(apiRoots, peopleResponse.data));

      if (import.meta.env.DEV) {
        console.info('[FamilyTreePage] layout v2-reference', {
          familyId: resolvedFamilyId,
          peopleCount: peopleResponse.meta?.total ?? peopleResponse.data.length,
        });
      }
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [requestedFamilyId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const refreshTree = useCallback(async () => {
    await loadTree(true);
  }, [loadTree]);

  if (loading) {
    return (
      <div
        className="reference-tree-app flex items-center justify-center"
        dir="rtl"
        lang="ar"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, #faf8f1 0%, #f3efe4 60%, #ece6d7 100%)',
          color: '#5c6652',
        }}
      >
        جاري تحميل شجرة العائلة...
      </div>
    );
  }

  if (error || familyId == null) {
    return (
      <div
        className="reference-tree-app flex items-center justify-center p-6 text-red-700"
        dir="rtl"
        lang="ar"
        style={{ background: '#f3efe6' }}
      >
        {error ?? 'تعذّر تحميل العائلة'}
      </div>
    );
  }

  return (
    <ReferenceTreeApp
      familyName={familyName}
      familyId={familyId}
      familyMembers={members}
      onTreeRefresh={refreshTree}
    />
  );
}
