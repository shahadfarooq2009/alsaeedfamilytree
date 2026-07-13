import { getMemberFirstName } from '../normalizeFamilyData';
import type { PositionedMember } from './types';

/** Arabic label from direct father_id only (for map connectors and tooltips). */
export function formatFatherChildRelation(
  member: Pick<PositionedMember, 'fatherId' | 'gender' | 'fullName'>,
  members: Pick<PositionedMember, 'id' | 'fullName'>[],
): string | null {
  if (member.fatherId == null) return null;

  const father = members.find((entry) => entry.id === member.fatherId);
  const fatherName = getMemberFirstName(father?.fullName ?? '');

  if (!fatherName) {
    return member.gender === 'female' ? 'ابنة' : 'ابن';
  }

  return member.gender === 'female' ? `ابنة ${fatherName}` : `ابن ${fatherName}`;
}

export function fatherChildGroups(
  members: PositionedMember[],
): Map<number, PositionedMember[]> {
  const groups = new Map<number, PositionedMember[]>();

  members.forEach((member) => {
    if (member.fatherId == null) return;
    const list = groups.get(member.fatherId) ?? [];
    list.push(member);
    groups.set(member.fatherId, list);
  });

  return groups;
}
