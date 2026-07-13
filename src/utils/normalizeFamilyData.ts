import type { HierarchyNode, PersonSummary } from '../types/person';
import type { FamilyMemberInput } from './treeLayout/types';
import { flattenHierarchyNodes } from './treeLayout/buildFamilyHierarchy';
import {
  applyResolvedGenerations,
  resolveMemberGeneration,
} from './resolveMemberGeneration';

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

/** Modal title: first name + father full name (e.g. فاطمة محمد سعيد). */
export function formatMemberNameWithFather(
  fullName: string,
  fatherFullName?: string | null,
): string {
  const trimmed = fullName.trim();
  const firstName = getMemberFirstName(trimmed);
  const father = fatherFullName?.trim() ?? '';

  if (!father) {
    return firstName;
  }

  if (trimmed.includes(father)) {
    return trimmed;
  }

  return `${firstName} ${father}`.trim();
}

/** Convert API hierarchy roots to flat layout input. */
export function hierarchyToFamilyMembers(roots: HierarchyNode[]): FamilyMemberInput[] {
  return applyResolvedGenerations(flattenHierarchyNodes(roots));
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
        fatherNameText: person.father_name_text ?? null,
        motherNameText: person.mother_name_text ?? null,
        gender: person.gender ?? undefined,
        generation: person.is_family_head
          ? 1
          : (person.generation_number != null && person.generation_number > 0
            ? person.generation_number
            : 0),
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
    if (existing.fatherNameText == null && person.father_name_text) {
      existing.fatherNameText = person.father_name_text;
    }
    if (existing.motherNameText == null && person.mother_name_text) {
      existing.motherNameText = person.mother_name_text;
    }
    if (person.is_family_head) {
      existing.isFamilyHead = true;
      existing.generation = 1;
    }
    if (existing.photoUrl == null && person.photo_url) {
      existing.photoUrl = person.photo_url;
    }
    if (person.generation_number != null && person.generation_number > 0) {
      existing.generation = person.generation_number;
    }
  });

  return applyResolvedGenerations(Array.from(byId.values()));
}

export { memberInitial };
