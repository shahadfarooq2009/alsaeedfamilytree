import { DEFAULT_MAX_BASE_GENERATIONS } from './gen5Expansion';
import { getDisplayGeneration, getGenerationBaseline } from './progressiveTreeDisclosure';
import { resolvePrimaryTreeParentId } from './treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from './treeLayout/types';

export const ADDED_MEMBER_GLOW_MS = 1600;

/** Returns the gen-5 parent to expand before focusing a newly added member. */
export function getGen5ParentToExpandForMember(
  memberId: number,
  members: FamilyMemberInput[],
): number | null {
  const member = members.find((entry) => entry.id === memberId);
  if (!member) return null;

  const baseline = getGenerationBaseline(members);
  if (getDisplayGeneration(member, baseline) !== DEFAULT_MAX_BASE_GENERATIONS + 1) {
    return null;
  }

  return resolvePrimaryTreeParentId(member);
}
