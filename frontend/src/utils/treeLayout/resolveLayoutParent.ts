export interface LayoutParentMember {
  id: number;
  fatherId: number | null;
  motherId?: number | null;
  generation: number;
  gender?: 'male' | 'female' | 'other';
  isFamilyHead?: boolean;
}

/**
 * Tree placement parent for layout.
 * Father link wins; otherwise children sit under their mother in her branch row.
 */
export function computeLayoutParentId(
  member: LayoutParentMember,
  members: LayoutParentMember[],
  memo: Map<number, number | null>,
): number | null {
  if (memo.has(member.id)) return memo.get(member.id)!;

  if (member.fatherId != null) {
    memo.set(member.id, member.fatherId);
    return member.fatherId;
  }

  if (member.motherId == null) {
    memo.set(member.id, null);
    return null;
  }

  const byId = new Map(members.map((entry) => [entry.id, entry]));

  const siblingFather = members.find(
    (candidate) =>
      candidate.id !== member.id
      && candidate.motherId === member.motherId
      && candidate.fatherId != null,
  )?.fatherId;
  if (siblingFather != null) {
    memo.set(member.id, siblingFather);
    return siblingFather;
  }

  if (byId.has(member.motherId)) {
    memo.set(member.id, member.motherId);
    return member.motherId;
  }

  memo.set(member.id, null);
  return null;
}

export function computeLayoutParentMap(members: LayoutParentMember[]): Map<number, number | null> {
  const memo = new Map<number, number | null>();
  [...members]
    .sort((a, b) => a.generation - b.generation || a.id - b.id)
    .forEach((member) => computeLayoutParentId(member, members, memo));
  return memo;
}
