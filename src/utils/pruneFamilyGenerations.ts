import type { FamilyMemberInput } from './treeLayout/types';

/** Keep only generations 1–2 in client state after pruning deeper branches. */
export const MAX_PERSISTED_GENERATION = 2;

export function filterMembersUpToGeneration(
  members: FamilyMemberInput[],
  maxGeneration = MAX_PERSISTED_GENERATION,
): FamilyMemberInput[] {
  return members.filter((member) => member.generation > 0 && member.generation <= maxGeneration);
}

export function filterPeopleUpToGeneration<T extends { generation_number?: number | null; is_family_head?: boolean }>(
  people: T[],
  maxGeneration = MAX_PERSISTED_GENERATION,
): T[] {
  return people.filter((person) => {
    if (person.is_family_head) return true;
    const generation = person.generation_number ?? 0;
    return generation > 0 && generation <= maxGeneration;
  });
}
