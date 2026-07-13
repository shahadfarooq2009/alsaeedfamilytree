import { useMemo } from 'react';

import FamilyTreeMap from '../components/family-tree-map/FamilyTreeMap';
import { useFamilyTreeMembers } from '../hooks/useFamilyTreeMembers';
import { familyMembersToMapPeople } from '../utils/familyMembersToMapPeople';

const PAGE_BACKGROUND =
  'radial-gradient(120% 90% at 50% 0%, #faf8f1 0%, #f3efe4 60%, #ece6d7 100%)';

export function FamilyTreeMapPage() {
  const { members, loading, error, familyId } = useFamilyTreeMembers();
  const mapPeople = useMemo(() => familyMembersToMapPeople(members), [members]);

  if (loading) {
    return (
      <div
        className="family-map-root flex items-center justify-center"
        dir="rtl"
        lang="ar"
        style={{ background: PAGE_BACKGROUND, color: '#5c6652' }}
      >
        جاري تحميل خريطة العائلة...
      </div>
    );
  }

  if (error || familyId == null) {
    return (
      <div
        className="family-map-root flex items-center justify-center p-6 text-red-700"
        dir="rtl"
        lang="ar"
        style={{ background: '#f3efe6' }}
      >
        {error ?? 'تعذّر تحميل العائلة'}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100dvh', background: PAGE_BACKGROUND }}>
      <FamilyTreeMap people={mapPeople} />
    </div>
  );
}
