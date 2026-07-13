import type { FamilyMemberInput } from '../treeLayout/types';
import { filterMembersByNameQuery } from '../filterMembersByNameQuery';
import { getMemberDisplayNameWithFather } from '../memberDisplayInfo';
import { cleanNameInput, normalizeArabicName } from '../normalizeArabicName';
import { nameSimilarityScore } from '../resolveParentFromName';

export interface KinshipMemberResolution {
  member: FamilyMemberInput | null;
  ambiguous: FamilyMemberInput[];
  notFound: boolean;
}

function scoreMemberMatch(
  member: FamilyMemberInput,
  query: string,
  members: FamilyMemberInput[],
  familyId?: number,
): number {
  const displayName = getMemberDisplayNameWithFather(member, members, familyId);
  return Math.max(
    nameSimilarityScore(member.fullName, query),
    nameSimilarityScore(displayName, query),
  );
}

export function suggestKinshipMembers(
  members: FamilyMemberInput[],
  query: string,
  familyId?: number,
  limit = 8,
): FamilyMemberInput[] {
  const cleaned = cleanNameInput(query);
  if (!cleaned) return [];

  const unique = new Map<number, FamilyMemberInput>();

  filterMembersByNameQuery(members, cleaned, limit).forEach((member) => {
    unique.set(member.id, member);
  });

  members
    .map((member) => ({
      member,
      score: scoreMemberMatch(member, cleaned, members, familyId),
    }))
    .filter((entry) => entry.score >= 60)
    .sort((left, right) => right.score - left.score)
    .forEach(({ member }) => {
      if (unique.size < limit) unique.set(member.id, member);
    });

  return Array.from(unique.values()).slice(0, limit);
}

export function resolveKinshipMember(
  members: FamilyMemberInput[],
  query: string,
  familyId?: number,
): KinshipMemberResolution {
  const cleaned = cleanNameInput(query);
  if (!cleaned) {
    return { member: null, ambiguous: [], notFound: true };
  }

  const normalizedQuery = normalizeArabicName(cleaned);
  const exactDisplayMatches = members.filter((member) => (
    normalizeArabicName(getMemberDisplayNameWithFather(member, members, familyId)) === normalizedQuery
    || normalizeArabicName(member.fullName) === normalizedQuery
  ));
  if (exactDisplayMatches.length === 1) {
    return { member: exactDisplayMatches[0], ambiguous: [], notFound: false };
  }
  if (exactDisplayMatches.length > 1) {
    return { member: null, ambiguous: exactDisplayMatches.slice(0, 5), notFound: false };
  }

  const byFullName = filterMembersByNameQuery(members, cleaned, 24);
  const byDisplayName = members
    .filter((member) => scoreMemberMatch(member, cleaned, members, familyId) >= 82)
    .slice(0, 24);

  const unique = new Map<number, FamilyMemberInput>();
  [...byFullName, ...byDisplayName].forEach((member) => unique.set(member.id, member));
  const candidates = Array.from(unique.values());

  if (candidates.length === 0) {
    return { member: null, ambiguous: [], notFound: true };
  }

  const scored = candidates
    .map((member) => ({
      member,
      score: scoreMemberMatch(member, cleaned, members, familyId),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1];

  if (!second || best.score - second.score >= 6 || best.score >= 98) {
    return { member: best.member, ambiguous: [], notFound: false };
  }

  return {
    member: null,
    ambiguous: scored.slice(0, 5).map((entry) => entry.member),
    notFound: false,
  };
}
