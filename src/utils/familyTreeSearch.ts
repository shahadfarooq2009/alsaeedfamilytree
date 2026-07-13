import type { FamilyMemberInput } from './treeLayout/types';

export function findMemberIdsByNameQuery(
  members: FamilyMemberInput[],
  query: string,
): number[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return members
    .filter((member) => member.fullName.toLowerCase().includes(normalized))
    .map((member) => member.id);
}
