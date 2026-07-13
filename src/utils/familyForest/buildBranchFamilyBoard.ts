import { getMemberFirstName } from '../normalizeFamilyData';
import { getFamilyMarriages } from '../marriageRegistry';
import {
  getBranchSubtreeMembers,
  resolveBranchDisplayParentId,
} from './getBranchSubtreeMembers';
import type { FamilyMemberInput } from '../treeLayout/types';
import { compareSiblingsByAddOrder } from '../treeLayout/siblingOrder';

export const BRANCH_BOARD_MAX_CHILD_CHIPS = 8;

export interface BranchBoardChildChip {
  member: FamilyMemberInput;
  directChildCount: number;
}

export interface BranchFamilyGroup {
  head: FamilyMemberInput;
  directChildCount: number;
  children: BranchBoardChildChip[];
}

export interface BranchBoardBreadcrumbItem {
  id: number | null;
  label: string;
}

function buildChildrenByParent(
  members: FamilyMemberInput[],
  branchHeadId: number,
  allMembers: FamilyMemberInput[],
  familyId?: number,
): Map<number, FamilyMemberInput[]> {
  const map = new Map<number, FamilyMemberInput[]>();
  const subtreeIds = new Set(members.map((member) => member.id));
  const marriages = familyId != null ? getFamilyMarriages(familyId) : [];

  members.forEach((member) => {
    if (member.id === branchHeadId) return;

    const parentId = marriages.length > 0
      ? resolveBranchDisplayParentId(
        member,
        branchHeadId,
        subtreeIds,
        allMembers,
        marriages,
      )
      : member.fatherId ?? member.motherId ?? null;
    if (parentId == null || parentId === member.id) return;
    const list = map.get(parentId) ?? [];
    list.push(member);
    map.set(parentId, list);
  });

  map.forEach((children) => {
    children.sort(compareSiblingsByAddOrder);
  });

  return map;
}

export function getBranchBoardChildrenByParent(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  familyId?: number,
): Map<number, FamilyMemberInput[]> {
  const subtree = getBranchSubtreeMembers(allMembers, branchHeadId, familyId);
  return buildChildrenByParent(subtree, branchHeadId, allMembers, familyId);
}

/** Direct children of a member within the branch subtree. */
export function getBranchBoardDirectChildren(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  parentId: number,
  familyId?: number,
): FamilyMemberInput[] {
  return getBranchBoardChildrenByParent(allMembers, branchHeadId, familyId).get(parentId) ?? [];
}

/** Direct children of the branch head — each becomes one family group card. */
export function buildBranchFamilyBoardGroups(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  maxChildChips = BRANCH_BOARD_MAX_CHILD_CHIPS,
  familyId?: number,
): BranchFamilyGroup[] {
  const subtree = getBranchSubtreeMembers(allMembers, branchHeadId, familyId);
  const childrenByParent = buildChildrenByParent(subtree, branchHeadId, allMembers, familyId);
  const branchHead = subtree.find((member) => member.id === branchHeadId);
  if (!branchHead) return [];

  const directChildren = (childrenByParent.get(branchHeadId) ?? [])
    .filter((child) => child.id !== branchHeadId);

  return directChildren.map((head) => {
    const directKids = childrenByParent.get(head.id) ?? [];
    const visibleKids = directKids.slice(0, maxChildChips);

    return {
      head,
      directChildCount: directKids.length,
      children: visibleKids.map((child) => ({
        member: child,
        directChildCount: (childrenByParent.get(child.id) ?? []).length,
      })),
    };
  });
}

function isMemberInBranchSubtree(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  memberId: number,
  familyId?: number,
): boolean {
  return getBranchSubtreeMembers(allMembers, branchHeadId, familyId)
    .some((member) => member.id === memberId);
}

export function buildBranchBoardBreadcrumb(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  branchLabel: string,
  selectedMemberId: number | null,
  familyId?: number,
): BranchBoardBreadcrumbItem[] {
  const crumbs: BranchBoardBreadcrumbItem[] = [
    { id: null, label: 'الرئيسية' },
    { id: branchHeadId, label: `فرع ${branchLabel}` },
  ];

  if (
    selectedMemberId == null
    || selectedMemberId === branchHeadId
    || !isMemberInBranchSubtree(allMembers, branchHeadId, selectedMemberId, familyId)
  ) {
    return crumbs;
  }

  const memberById = new Map(allMembers.map((member) => [member.id, member]));
  const subtree = getBranchSubtreeMembers(allMembers, branchHeadId, familyId);
  const subtreeIds = new Set(subtree.map((member) => member.id));
  const marriages = familyId != null ? getFamilyMarriages(familyId) : [];
  const path: FamilyMemberInput[] = [];
  let current = memberById.get(selectedMemberId);

  while (current && current.id !== branchHeadId) {
    path.unshift(current);
    const parentId = marriages.length > 0
      ? resolveBranchDisplayParentId(
        current,
        branchHeadId,
        subtreeIds,
        allMembers,
        marriages,
      )
      : current.fatherId ?? current.motherId ?? null;
    if (parentId == null || parentId === current.id) break;
    if (!isMemberInBranchSubtree(allMembers, branchHeadId, parentId, familyId)) break;
    current = memberById.get(parentId);
  }

  path.forEach((member) => {
    crumbs.push({
      id: member.id,
      label: getMemberFirstName(member.fullName),
    });
  });

  return crumbs;
}

/** Selected person + direct parent + direct children only. */
export function getBranchBoardHighlightIds(
  allMembers: FamilyMemberInput[],
  branchHeadId: number,
  selectedMemberId: number | null,
  familyId?: number,
): Set<number> {
  const highlighted = new Set<number>();
  if (selectedMemberId == null) return highlighted;

  const subtree = getBranchSubtreeMembers(allMembers, branchHeadId, familyId);
  const subtreeIds = new Set(subtree.map((member) => member.id));
  if (!subtreeIds.has(selectedMemberId)) return highlighted;

  highlighted.add(selectedMemberId);

  const memberById = new Map(allMembers.map((member) => [member.id, member]));
  const selected = memberById.get(selectedMemberId);
  if (!selected) return highlighted;

  const marriages = familyId != null ? getFamilyMarriages(familyId) : [];
  const parentId = marriages.length > 0
    ? resolveBranchDisplayParentId(
      selected,
      branchHeadId,
      subtreeIds,
      allMembers,
      marriages,
    )
    : selected.fatherId ?? selected.motherId ?? null;
  if (parentId != null && subtreeIds.has(parentId)) {
    highlighted.add(parentId);
  }

  const childrenByParent = buildChildrenByParent(subtree, branchHeadId, allMembers, familyId);
  for (const child of childrenByParent.get(selectedMemberId) ?? []) {
    highlighted.add(child.id);
  }

  return highlighted;
}
