import type { FamilyMemberInput } from './treeLayout/types';

export interface FatherMatch {
  id: number;
  fullName: string;
  generation: number;
}

/** Search registered members by father name for add-member flow. */
export function findFatherByName(
  members: FamilyMemberInput[],
  fatherName: string,
): FatherMatch[] {
  const query = fatherName.trim();
  if (!query) return [];

  const normalized = query.toLowerCase();
  return members
    .filter((member) => member.fullName.trim().toLowerCase() === normalized)
    .map((member) => ({
      id: member.id,
      fullName: member.fullName,
      generation: member.generation,
    }));
}
