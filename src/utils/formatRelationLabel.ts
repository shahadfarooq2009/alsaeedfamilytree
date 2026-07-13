export interface RelationMember {
  id: number;
  fullName: string;
  fatherId: number | null;
  motherId?: number | null;
  gender?: 'male' | 'female' | 'other';
  generation: number;
}

function isFemale(member: RelationMember): boolean {
  return member.gender === 'female';
}

/** Dynamic Arabic relation label from member data and family context. */
export function formatRelationLabel(member: RelationMember, members: RelationMember[]): string {
  const linkedParentId = member.fatherId ?? member.motherId ?? null;

  if (linkedParentId == null) {
    return 'الجد';
  }

  const parent = members.find((entry) => entry.id === linkedParentId)?.fullName ?? null;
  const female = isFemale(member);

  if (member.generation === 2) {
    return female ? 'ابنة' : 'ابن';
  }

  if (member.generation === 3) {
    if (parent) {
      return female ? `ابنة ${parent}` : `ابن ${parent}`;
    }
    return female ? 'حفيدة' : 'حفيد';
  }

  if (member.generation === 4) {
    if (parent) {
      return female ? `ابنة ${parent}` : `ابن ${parent}`;
    }
    return female ? 'بنت حفيد' : 'ابن حفيد';
  }

  if (parent) {
    return female ? `ابنة ${parent}` : `ابن ${parent}`;
  }

  return female ? 'ابنة' : 'ابن';
}
