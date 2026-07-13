import { matchParentByFullName } from '../addMember/resolveAddMemberPlacement';
import {
  findMarriageByPersonId,
  getFamilyMarriages,
  type MarriageRecord,
} from '../marriageRegistry';
import { buildFamilyHierarchy, flattenLayoutNodes } from '../treeLayout/buildFamilyHierarchy';
import { resolvePrimaryTreeParentId } from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput, LayoutTreeNode } from '../treeLayout/types';

function findTreeNode(roots: LayoutTreeNode[], headId: number): LayoutTreeNode | null {
  for (const root of roots) {
    if (root.id === headId) return root;
    const found = findTreeNode(root.children, headId);
    if (found) return found;
  }
  return null;
}

/** Fallback when hierarchy search misses a visible forest card. */
function collectSubtreeMembersFallback(
  allMembers: FamilyMemberInput[],
  headId: number,
): FamilyMemberInput[] {
  const memberById = new Map(allMembers.map((member) => [member.id, member]));
  if (!memberById.has(headId)) return [];

  const childrenByParent = new Map<number, number[]>();
  allMembers.forEach((member) => {
    const parentId = resolvePrimaryTreeParentId(member);
    if (parentId == null) return;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(member.id);
    childrenByParent.set(parentId, list);
  });

  const ordered: FamilyMemberInput[] = [];
  const visited = new Set<number>();

  const walk = (id: number): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const member = memberById.get(id);
    if (!member) return;
    ordered.push(member);
    const children = childrenByParent.get(id) ?? [];
    children.sort((left, right) => left - right);
    children.forEach(walk);
  };

  walk(headId);
  return ordered;
}

function resolveSpouseMemberId(
  memberId: number,
  allMembers: FamilyMemberInput[],
  marriages: MarriageRecord[],
): number | null {
  const marriage = findMarriageByPersonId(marriages, memberId);
  if (!marriage) return null;

  if (marriage.husbandId === memberId && marriage.wifeId != null) return marriage.wifeId;
  if (marriage.wifeId === memberId && marriage.husbandId != null) return marriage.husbandId;

  const member = allMembers.find((item) => item.id === memberId);
  if (member?.gender === 'male' && marriage.wifeName) {
    const wifeMatch = matchParentByFullName(allMembers, marriage.wifeName, 'mother');
    if (wifeMatch.status === 'single') return wifeMatch.members[0].id;
  }

  if (member?.gender === 'female' && marriage.husbandName) {
    const husbandMatch = matchParentByFullName(allMembers, marriage.husbandName, 'father');
    if (husbandMatch.status === 'single') return husbandMatch.members[0].id;
  }

  return null;
}

function isMarriageLinkedChild(
  child: FamilyMemberInput,
  memberId: number,
  spouseId: number | null,
): boolean {
  if (child.fatherId === memberId || child.motherId === memberId) return true;
  if (spouseId == null) return false;
  return child.fatherId === spouseId || child.motherId === spouseId;
}

function appendMemberSubtree(
  allMembers: FamilyMemberInput[],
  memberId: number,
  ordered: FamilyMemberInput[],
  visited: Set<number>,
): void {
  const subtree = getMemberSubtreeMembers(allMembers, memberId);
  subtree.forEach((member) => {
    if (visited.has(member.id)) return;
    visited.add(member.id);
    ordered.push(member);
  });
}

/** Include joint children from cross-branch marriages in a branch subtree. */
function expandSubtreeWithMarriageChildren(
  allMembers: FamilyMemberInput[],
  baseSubtree: FamilyMemberInput[],
  familyId?: number,
): FamilyMemberInput[] {
  if (familyId == null || baseSubtree.length === 0) return baseSubtree;

  const marriages = getFamilyMarriages(familyId);
  if (marriages.length === 0) return baseSubtree;

  const ordered = [...baseSubtree];
  const visited = new Set(baseSubtree.map((member) => member.id));

  baseSubtree.forEach((member) => {
    const spouseId = resolveSpouseMemberId(member.id, allMembers, marriages);
    allMembers.forEach((child) => {
      if (visited.has(child.id)) return;
      if (!isMarriageLinkedChild(child, member.id, spouseId)) return;
      appendMemberSubtree(allMembers, child.id, ordered, visited);
    });
  });

  return ordered;
}

/** Pick the parent that belongs to the current branch map. */
export function resolveBranchDisplayParentId(
  member: FamilyMemberInput,
  branchHeadId: number,
  subtreeIds: Set<number>,
  allMembers: FamilyMemberInput[],
  marriages: MarriageRecord[],
): number | null {
  if (member.id === branchHeadId) {
    return null;
  }

  const primaryParentId = resolvePrimaryTreeParentId(member);
  if (primaryParentId != null && subtreeIds.has(primaryParentId)) {
    return primaryParentId;
  }

  if (member.fatherId != null && subtreeIds.has(member.fatherId)) {
    return member.fatherId;
  }

  if (member.motherId != null && subtreeIds.has(member.motherId)) {
    return member.motherId;
  }

  const outsideParentId = member.fatherId ?? member.motherId ?? primaryParentId;
  if (outsideParentId != null) {
    const marriage = findMarriageByPersonId(marriages, outsideParentId);
    if (marriage) {
      if (marriage.wifeId != null && subtreeIds.has(marriage.wifeId)) return marriage.wifeId;
      if (marriage.husbandId != null && subtreeIds.has(marriage.husbandId)) return marriage.husbandId;
    }

    for (const branchMemberId of subtreeIds) {
      if (branchMemberId === member.id) continue;
      const branchMarriage = findMarriageByPersonId(marriages, branchMemberId);
      if (!branchMarriage) continue;

      if (
        branchMarriage.husbandId === outsideParentId
        || branchMarriage.wifeId === outsideParentId
      ) {
        return branchMemberId;
      }
    }
  }

  return branchHeadId;
}

/** All members in any person's subtree (head included). */
export function getMemberSubtreeMembers(
  allMembers: FamilyMemberInput[],
  headId: number,
  familyId?: number,
): FamilyMemberInput[] {
  const memberById = new Map(allMembers.map((member) => [member.id, member]));
  const roots = buildFamilyHierarchy(allMembers);
  const headNode = findTreeNode(roots, headId);

  const base = headNode
    ? flattenLayoutNodes([headNode])
      .map((node) => memberById.get(node.id))
      .filter((member): member is FamilyMemberInput => member != null)
    : collectSubtreeMembersFallback(allMembers, headId);

  return expandSubtreeWithMarriageChildren(allMembers, base, familyId);
}

/** All members in a gen-2 branch head's subtree (branch head included). */
export function getBranchSubtreeMembers(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  familyId?: number,
): FamilyMemberInput[] {
  return getMemberSubtreeMembers(allMembers, branchHeadId, familyId);
}

/** Re-root a subtree for React Flow (head becomes generation-1 founder). */
export function prepareBranchSubtreeForFlow(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  familyId?: number,
): FamilyMemberInput[] {
  const subtree = getMemberSubtreeMembers(allMembers, branchHeadId, familyId);
  const head = subtree.find((member) => member.id === branchHeadId);
  if (!head) return [];

  const subtreeIds = new Set(subtree.map((member) => member.id));
  const baseGeneration = head.generation;
  const marriages = familyId != null ? getFamilyMarriages(familyId) : [];

  return subtree.map((member) => {
    const generation = member.generation - baseGeneration + 1;

    if (member.id === branchHeadId) {
      return {
        ...member,
        generation: 1,
        fatherId: null,
        motherId: null,
        treeParentId: undefined,
        displayParentId: undefined,
      };
    }

    const treeParentId = marriages.length > 0
      ? resolveBranchDisplayParentId(
        member,
        branchHeadId,
        subtreeIds,
        allMembers,
        marriages,
      )
      : (() => {
        const parentId = resolvePrimaryTreeParentId(member);
        return parentId != null && subtreeIds.has(parentId)
          ? parentId
          : branchHeadId;
      })();

    return {
      ...member,
      generation,
      fatherId: null,
      motherId: null,
      treeParentId,
      displayParentId: undefined,
    };
  });
}
