import type { PersonSummary } from '../types/person';
import type { FamilyMemberInput } from './treeLayout/types';

type GenerationMember = Pick<
  FamilyMemberInput,
  'id' | 'generation' | 'fatherId' | 'motherId' | 'isFamilyHead'
>;

/** Resolve generation from stored value or linked parents (matches backend rules). */
export function resolveMemberGeneration(
  member: GenerationMember,
  membersById: Map<number, GenerationMember>,
  visiting = new Set<number>(),
): number {
  if (member.isFamilyHead) {
    return 1;
  }

  if (member.generation > 0) {
    return member.generation;
  }

  if (visiting.has(member.id)) {
    return 0;
  }

  visiting.add(member.id);

  const parentGenerations: number[] = [];

  if (member.fatherId != null) {
    const father = membersById.get(member.fatherId);
    if (father) {
      parentGenerations.push(resolveMemberGeneration(father, membersById, visiting));
    }
  }

  if (member.motherId != null) {
    const mother = membersById.get(member.motherId);
    if (mother) {
      parentGenerations.push(resolveMemberGeneration(mother, membersById, visiting));
    }
  }

  visiting.delete(member.id);

  const validParents = parentGenerations.filter((generation) => generation > 0);
  if (validParents.length === 0) {
    return 0;
  }

  return Math.max(...validParents) + 1;
}

export function personSummaryToGenerationMember(person: PersonSummary): GenerationMember {
  return {
    id: person.id,
    generation: person.generation_number ?? 0,
    fatherId: person.father?.id ?? null,
    motherId: person.mother?.id ?? null,
    isFamilyHead: person.is_family_head ?? false,
  };
}

export function applyResolvedGenerations(members: FamilyMemberInput[]): FamilyMemberInput[] {
  const membersById = new Map(members.map((member) => [member.id, member]));

  return members.map((member) => {
    const resolved = resolveMemberGeneration(member, membersById);
    if (resolved <= 0 || resolved === member.generation) {
      return member;
    }

    return { ...member, generation: resolved };
  });
}
