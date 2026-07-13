export interface PrimaryParentMember {
  id: number;
  fullName: string;
  fatherId: number | null;
  motherId?: number | null;
  treeParentId?: number | null;
  displayParentId?: number | null;
  generation: number;
  isFamilyHead?: boolean;
}

/** Explicit visual-tree parent — independent from gender. */
export function resolvePrimaryTreeParentId(member: PrimaryParentMember): number | null {
  if (member.treeParentId != null) return member.treeParentId;
  if (member.displayParentId != null) return member.displayParentId;
  if (member.fatherId != null) return member.fatherId;
  if (member.motherId != null) return member.motherId;
  return null;
}

export function buildPrimaryTreeParentMap(
  members: PrimaryParentMember[],
): Map<number, number | null> {
  const map = new Map<number, number | null>();
  members.forEach((member) => {
    map.set(member.id, resolvePrimaryTreeParentId(member));
  });
  return map;
}

export function countUnresolvedPrimaryParents(
  members: PrimaryParentMember[],
  parentMap: Map<number, number | null>,
  memberIds: Set<number>,
): number {
  let count = 0;
  members.forEach((member) => {
    if (member.isFamilyHead) return;
    const parentId = parentMap.get(member.id);
    if (parentId == null) {
      if (member.fatherId != null || member.motherId != null) count += 1;
      return;
    }
    if (!memberIds.has(parentId)) count += 1;
  });
  return count;
}

export function computeMainBranchRootMap(
  memberIds: Set<number>,
  parentMap: Map<number, number | null>,
  founderDirectChildIds: Set<number>,
): Map<number, number> {
  const memo = new Map<number, number>();

  const resolve = (memberId: number): number => {
    if (memo.has(memberId)) return memo.get(memberId)!;
    if (founderDirectChildIds.has(memberId)) {
      memo.set(memberId, memberId);
      return memberId;
    }

    const parentId = parentMap.get(memberId);
    if (parentId == null || !memberIds.has(parentId)) {
      memo.set(memberId, memberId);
      return memberId;
    }

    const root = resolve(parentId);
    memo.set(memberId, root);
    return root;
  };

  memberIds.forEach((id) => resolve(id));
  return memo;
}
