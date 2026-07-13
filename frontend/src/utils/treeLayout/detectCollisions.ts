import { cardBoxesCollide, memberCardBBox, MIN_CARD_GAP } from './cardBounds';
import { cardWidthForMember, getFamilyGroupGap, getSiblingGap } from './constants';
import type { LayoutTreeNode, PositionedMember } from './types';

function collectSubtreeIds(node: LayoutTreeNode, out: Set<number>): void {
  if (node.id >= 0) out.add(node.id);
  node.children.forEach((child) => collectSubtreeIds(child, out));
}

/** Map each member to its top-level branch root (direct child of founder). */
export function buildBranchRootMap(roots: LayoutTreeNode[]): Map<number, number> {
  const map = new Map<number, number>();

  const walk = (node: LayoutTreeNode, branchRoot: number): void => {
    if (node.id >= 0) map.set(node.id, branchRoot);
    node.children.forEach((child) => walk(child, branchRoot));
  };

  roots.forEach((root) => {
    if (root.id >= 0) map.set(root.id, root.id);
    root.children.forEach((child) => walk(child, child.id));
  });

  return map;
}

function shiftMembersById(
  members: PositionedMember[],
  ids: Set<number>,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  members.forEach((member) => {
    if (ids.has(member.id)) {
      member.x += dx;
      member.y += dy;
    }
  });
}

function separationVector(
  a: ReturnType<typeof memberCardBBox>,
  b: ReturnType<typeof memberCardBBox>,
  gap: number,
): { dx: number; dy: number } {
  const overlapX = (a.right - a.left + (b.right - b.left)) / 2 + gap - Math.abs(
    (a.left + a.right) / 2 - (b.left + b.right) / 2,
  );
  const overlapY = (a.bottom - a.top + (b.bottom - b.top)) / 2 + gap - Math.abs(
    (a.top + a.bottom) / 2 - (b.top + b.top) / 2,
  );

  if (overlapX <= 0 && overlapY <= 0) return { dx: 0, dy: 0 };

  if (overlapX > 0 && (overlapX <= overlapY || overlapY <= 0)) {
    const dir = (a.left + a.right) / 2 <= (b.left + b.right) / 2 ? -1 : 1;
    return { dx: dir * overlapX, dy: 0 };
  }

  const dir = (a.top + a.bottom) / 2 <= (b.top + b.top) / 2 ? -1 : 1;
  return { dx: 0, dy: dir * overlapY };
}

function subtreeIdsForMember(
  memberId: number,
  roots: LayoutTreeNode[],
): Set<number> {
  const ids = new Set<number>();

  const findAndCollect = (node: LayoutTreeNode): boolean => {
    if (node.id === memberId) {
      collectSubtreeIds(node, ids);
      return true;
    }
    return node.children.some(findAndCollect);
  };

  roots.some(findAndCollect);
  if (ids.size === 0) ids.add(memberId);
  return ids;
}

/** Push whole father-child units apart on the same generation row. */
export function resolveFamilyGroupRowOverlaps(
  members: PositionedMember[],
  roots: LayoutTreeNode[],
): PositionedMember[] {
  const positioned = members.map((member) => ({ ...member }));
  const byId = new Map(positioned.map((member) => [member.id, member]));
  const branchMap = buildBranchRootMap(roots);
  const familyGap = Math.max(MIN_CARD_GAP, getFamilyGroupGap());

  const units = new Map<string, {
    ids: number[];
    minX: number;
    maxX: number;
    rowKey: string;
  }>();

  positioned.forEach((member) => {
    if (member.fatherId == null) return;
    const unitKey = `${member.fatherId}`;
    const rowKey = `${branchMap.get(member.id) ?? member.id}-${member.generation}`;
    const width = cardWidthForMember(member);
    const existing = units.get(unitKey);

    if (!existing) {
      units.set(unitKey, {
        ids: [member.id],
        minX: member.x,
        maxX: member.x + width,
        rowKey,
      });
      return;
    }

    existing.ids.push(member.id);
    existing.minX = Math.min(existing.minX, member.x);
    existing.maxX = Math.max(existing.maxX, member.x + width);
  });

  const rows = new Map<string, Array<{
    ids: number[];
    minX: number;
    maxX: number;
  }>>();

  units.forEach((unit) => {
    const list = rows.get(unit.rowKey) ?? [];
    list.push(unit);
    rows.set(unit.rowKey, list);
  });

  rows.forEach((rowUnits) => {
    rowUnits.sort((a, b) => a.minX - b.minX);
    let prevRight = Number.NEGATIVE_INFINITY;

    rowUnits.forEach((unit) => {
      const shift = prevRight === Number.NEGATIVE_INFINITY
        ? 0
        : Math.max(0, prevRight + familyGap - unit.minX);

      if (shift > 0) {
        unit.ids.forEach((id) => {
          const member = byId.get(id);
          if (member) member.x += shift;
        });
        unit.minX += shift;
        unit.maxX += shift;
      }

      prevRight = unit.maxX;
    });
  });

  return positioned;
}

/**
 * Resolve card overlaps by shifting whole subtrees horizontally first,
 * then vertically only when generations differ.
 */
export function resolveLayoutCollisions(
  members: PositionedMember[],
  roots: LayoutTreeNode[],
  maxPasses = 120,
): PositionedMember[] {
  const positioned = members.map((member) => ({ ...member }));
  const branchRoots = buildBranchRootMap(roots);
  const gap = Math.max(MIN_CARD_GAP, getSiblingGap());

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false;
    const boxes = positioned.map(memberCardBBox);

    outer:
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (!cardBoxesCollide(a, b, gap)) continue;

        const { dx, dy } = separationVector(a, b, gap);
        if (dx === 0 && dy === 0) continue;

        const memberA = positioned.find((m) => m.id === a.id)!;
        const memberB = positioned.find((m) => m.id === b.id)!;
        const branchA = branchRoots.get(a.id) ?? a.id;
        const branchB = branchRoots.get(b.id) ?? b.id;

        if (dx !== 0) {
          const moveB = Math.abs(dx);
          const sameFather = memberA.fatherId != null
            && memberA.fatherId === memberB.fatherId;

          if (sameFather) {
            memberA.x -= moveB / 2;
            memberB.x += moveB / 2;
          } else if (branchA !== branchB) {
            const ids = subtreeIdsForMember(
              (a.left + a.right) / 2 <= (b.left + b.right) / 2 ? memberB.id : memberA.id,
              roots,
            );
            const dir = (a.left + a.right) / 2 <= (b.left + b.right) / 2 ? 1 : -1;
            shiftMembersById(positioned, ids, dir * moveB, 0);
          } else {
            memberA.x -= moveB / 2;
            memberB.x += moveB / 2;
          }
          moved = true;
          break outer;
        }

        // Keep generation rows fixed — resolve overlaps horizontally only.
        if (dy !== 0) {
          continue;
        }
      }
    }

    if (!moved) break;
  }

  return positioned;
}
