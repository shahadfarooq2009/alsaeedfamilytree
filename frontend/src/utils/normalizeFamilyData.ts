import type { HierarchyNode, PersonSummary } from '../types/person';
import type { FamilyMemberInput } from './treeLayout/types';
import { flattenHierarchyNodes } from './treeLayout/buildFamilyHierarchy';

function memberInitial(name: string): string {
  const firstName = getMemberFirstName(name);
  return firstName !== '—' ? firstName.charAt(0) : '?';
}

/** First given name only — for compact card labels. */
export function getMemberFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '—';
  return trimmed.split(/\s+/)[0];
}

/** Convert API hierarchy roots to flat layout input. */
export function hierarchyToFamilyMembers(roots: HierarchyNode[]): FamilyMemberInput[] {
  return flattenHierarchyNodes(roots);
}

/**
 * Merge flat people list with tree nodes so mother-linked members never drop
 * off the layout when the nested tree response is incomplete.
 */
export function mergePeopleIntoHierarchy(
  roots: HierarchyNode[],
  people: PersonSummary[],
): FamilyMemberInput[] {
  const byId = new Map(flattenHierarchyNodes(roots).map((member) => [member.id, member]));

  people.forEach((person) => {
    const fatherId = person.father?.id ?? null;
    const motherId = person.mother?.id ?? null;

    const existing = byId.get(person.id);
    if (!existing) {
      byId.set(person.id, {
        id: person.id,
        fullName: person.full_name,
        fatherId,
        motherId,
        gender: person.gender ?? undefined,
        generation: person.generation_number ?? 1,
        initial: memberInitial(person.full_name),
        photoUrl: person.photo_url ?? null,
        isFamilyHead: person.is_family_head ?? false,
      });
      return;
    }

    if (existing.fatherId == null && fatherId != null) {
      existing.fatherId = fatherId;
    }
    if (existing.motherId == null && motherId != null) {
      existing.motherId = motherId;
    }
    if (person.is_family_head) {
      existing.isFamilyHead = true;
    }
    if (existing.photoUrl == null && person.photo_url) {
      existing.photoUrl = person.photo_url;
    }
    if (person.generation_number != null && person.generation_number > 0) {
      existing.generation = person.generation_number;
    }
  });

  return Array.from(byId.values());
}

export { memberInitial };
