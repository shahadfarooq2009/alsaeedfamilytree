import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import FamilyTreeMap from '../components/family-tree-map/FamilyTreeMap';
import { FamilyForestView } from '../components/family-forest/FamilyForestView';
import { ReferenceTreeApp } from '../components/reference-tree/ReferenceTreeApp';
import { ReferenceTreeSkeleton } from '../components/reference-tree/ReferenceTreeSkeleton';
import { useFamilyTreeMembers } from '../hooks/useFamilyTreeMembers';
import { familyMembersToMapPeople } from '../utils/familyMembersToMapPeople';
import { saveShareAccessMode, type ShareAccessMode } from '../utils/familyTreeShare';

const PAGE_BACKGROUND =
  'radial-gradient(120% 90% at 50% 0%, #faf8f1 0%, #f3efe4 60%, #ece6d7 100%)';

export function FamilyTreePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') ?? 'forest';
  const {
    familyId,
    familyName,
    founderPersonId,
    members,
    people,
    loading,
    error,
    refreshTree,
  } = useFamilyTreeMembers();

  const mapPeople = useMemo(() => familyMembersToMapPeople(members), [members]);

  useEffect(() => {
    if (familyId == null) return;

    const inviteToken = searchParams.get('invite');
    const access = searchParams.get('access');
    if (inviteToken) {
      window.localStorage.setItem(`family-tree-invite-token:${familyId}`, inviteToken);
    }
    if (access === 'view' || access === 'edit') {
      saveShareAccessMode(familyId, access as ShareAccessMode);
    }
  }, [familyId, searchParams]);

  if (loading) {
    return <ReferenceTreeSkeleton />;
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

  if (viewMode === 'map') {
    return (
      <div style={{ width: '100%', height: '100dvh', background: PAGE_BACKGROUND }}>
        <FamilyTreeMap people={mapPeople} />
      </div>
    );
  }

  if (viewMode === 'tree') {
    return (
      <ReferenceTreeApp
        familyName={familyName}
        familyId={familyId}
        founderPersonId={founderPersonId}
        familyMembers={members}
        onTreeRefresh={refreshTree}
        onOpenForest={() => {
          const params = new URLSearchParams(searchParams);
          params.set('view', 'forest');
          navigate(`?${params.toString()}`, { replace: true });
        }}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100dvh', background: PAGE_BACKGROUND }}>
      <FamilyForestView
        familyName={familyName}
        familyId={familyId}
        founderPersonId={founderPersonId}
        members={members}
        people={people}
        onTreeRefresh={refreshTree}
        onBackToTree={() => {
          const params = new URLSearchParams(searchParams);
          params.set('view', 'tree');
          navigate(`?${params.toString()}`, { replace: true });
        }}
      />
    </div>
  );
}
