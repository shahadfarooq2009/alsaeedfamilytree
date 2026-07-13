import { getAncestorPathIds, resolveMemberParentId } from './familyTreeFlowPath';
import { isFounderMember } from './treeLayout/constants';
import type { FamilyMemberInput } from './treeLayout/types';

/** How many generations to show from the current focus root. */
export const DEFAULT_MAX_VISIBLE_GENERATIONS = 4;

export interface DisclosureContext {
  branchRootId: number | null;
  maxGenerations: number;
}

export function getInitialDisclosureContext(): DisclosureContext {
  return { branchRootId: null, maxGenerations: DEFAULT_MAX_VISIBLE_GENERATIONS };
}

export function getGenerationBaseline(members: FamilyMemberInput[]): number {
  const founders = members.filter((member) => isFounderMember(member));
  if (founders.length > 0) {
    return Math.min(...founders.map((member) => member.generation));
  }

  if (members.length === 0) return 1;

  return members.reduce(
    (min, member) => Math.min(min, member.generation),
    members[0].generation,
  );
}

export function getDisplayGeneration(member: FamilyMemberInput, baseline: number): number {
  return member.generation - baseline + 1;
}

export function buildChildrenMap(members: FamilyMemberInput[]): Map<number, number[]> {
  const childrenMap = new Map<number, number[]>();

  members.forEach((member) => {
    const parentId = resolveMemberParentId(member);
    if (parentId == null) return;
    const siblings = childrenMap.get(parentId) ?? [];
    siblings.push(member.id);
    childrenMap.set(parentId, siblings);
  });

  return childrenMap;
}

export function collectDescendantIds(
  rootId: number,
  childrenMap: Map<number, number[]>,
): Set<number> {
  const descendants = new Set<number>();
  const stack = [rootId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId == null || descendants.has(currentId)) continue;
    descendants.add(currentId);
    (childrenMap.get(currentId) ?? []).forEach((childId) => stack.push(childId));
  }

  return descendants;
}

function getContextRootMember(
  context: DisclosureContext,
  members: FamilyMemberInput[],
): FamilyMemberInput | null {
  if (context.branchRootId == null) return null;
  return members.find((member) => member.id === context.branchRootId) ?? null;
}

export function getRelativeDisplayGeneration(
  member: FamilyMemberInput,
  context: DisclosureContext,
  baseline: number,
  members: FamilyMemberInput[],
): number {
  const rootMember = getContextRootMember(context, members);
  if (!rootMember) {
    return getDisplayGeneration(member, baseline);
  }

  return member.generation - rootMember.generation + 1;
}

export function filterMembersForDisclosure(
  allMembers: FamilyMemberInput[],
  context: DisclosureContext,
): FamilyMemberInput[] {
  if (allMembers.length === 0) return [];

  const baseline = getGenerationBaseline(allMembers);
  const childrenMap = buildChildrenMap(allMembers);

  if (context.branchRootId == null) {
    return allMembers.filter(
      (member) => getRelativeDisplayGeneration(member, context, baseline, allMembers)
        <= context.maxGenerations,
    );
  }

  const subtreeIds = collectDescendantIds(context.branchRootId, childrenMap);
  return allMembers.filter((member) => {
    if (!subtreeIds.has(member.id)) return false;
    return getRelativeDisplayGeneration(member, context, baseline, allMembers)
      <= context.maxGenerations;
  });
}

export function countHiddenDescendants(
  memberId: number,
  allMembers: FamilyMemberInput[],
  visibleMemberIds: ReadonlySet<number>,
): number {
  const childrenMap = buildChildrenMap(allMembers);
  const descendants = collectDescendantIds(memberId, childrenMap);

  let hidden = 0;
  descendants.forEach((descendantId) => {
    if (descendantId !== memberId && !visibleMemberIds.has(descendantId)) {
      hidden += 1;
    }
  });

  return hidden;
}

export function isExpandableFrontierMember(
  memberId: number,
  allMembers: FamilyMemberInput[],
  visibleMembers: FamilyMemberInput[],
  context: DisclosureContext,
): boolean {
  const member = allMembers.find((entry) => entry.id === memberId);
  if (!member) return false;

  const baseline = getGenerationBaseline(allMembers);
  const relativeGeneration = getRelativeDisplayGeneration(member, context, baseline, allMembers);
  if (relativeGeneration !== context.maxGenerations) {
    return false;
  }

  const visibleIds = new Set(visibleMembers.map((entry) => entry.id));
  return countHiddenDescendants(memberId, allMembers, visibleIds) > 0;
}

export function getExpandableMemberIds(
  allMembers: FamilyMemberInput[],
  visibleMembers: FamilyMemberInput[],
  context: DisclosureContext,
): Set<number> {
  const expandable = new Set<number>();

  visibleMembers.forEach((member) => {
    if (isExpandableFrontierMember(member.id, allMembers, visibleMembers, context)) {
      expandable.add(member.id);
    }
  });

  return expandable;
}

export function buildDisclosureStackForMember(
  memberId: number,
  allMembers: FamilyMemberInput[],
  maxGenerations = DEFAULT_MAX_VISIBLE_GENERATIONS,
): DisclosureContext[] {
  const stack: DisclosureContext[] = [getInitialDisclosureContext()];
  const member = allMembers.find((entry) => entry.id === memberId);
  if (!member) return stack;

  const baseline = getGenerationBaseline(allMembers);
  const memberRelativeGeneration = getDisplayGeneration(member, baseline);
  if (memberRelativeGeneration <= maxGenerations) {
    return stack;
  }

  const membersById = new Map(allMembers.map((entry) => [entry.id, entry]));
  const ancestors = getAncestorPathIds(memberId, allMembers).map((id) => Number(id));

  let rootGeneration = baseline;
  while (member.generation - rootGeneration + 1 > maxGenerations) {
    const frontierGeneration = rootGeneration + maxGenerations - 1;
    const branchRootId = ancestors.find((ancestorId) => (
      membersById.get(ancestorId)?.generation === frontierGeneration
    ));

    if (branchRootId == null) break;

    stack.push({ branchRootId, maxGenerations });
    rootGeneration = frontierGeneration;
  }

  return stack;
}

export function getDisclosureBreadcrumbItems(
  stack: DisclosureContext[],
  allMembers: FamilyMemberInput[],
): Array<{ key: string; label: string; stackIndex: number }> {
  const membersById = new Map(allMembers.map((member) => [member.id, member]));
  const items: Array<{ key: string; label: string; stackIndex: number }> = [
    { key: 'root', label: 'الشجرة الكاملة', stackIndex: 0 },
  ];

  stack.slice(1).forEach((context, index) => {
    const member = context.branchRootId != null
      ? membersById.get(context.branchRootId)
      : null;
    const label = member?.fullName?.trim() || `فرع ${index + 1}`;
    items.push({
      key: `branch-${context.branchRootId ?? index}`,
      label,
      stackIndex: index + 1,
    });
  });

  return items;
}
