import {
  cardHeightForMember,
  cardWidthForMember,
  getBadgeOverhang,
  getFounderBadgeOverhang,
  isFounderMember,
} from './constants';
import type { PositionedMember } from './types';

/** Minimum visible gap between card edges (8–12px range). */
export const MIN_CARD_GAP = 10;

export interface CardBBox {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function memberCardBBox(member: PositionedMember): CardBBox {
  const width = cardWidthForMember(member);
  const bodyHeight = cardHeightForMember(member);
  const badgeOverhang = isFounderMember(member)
    ? getFounderBadgeOverhang()
    : getBadgeOverhang();

  return {
    id: member.id,
    left: member.x,
    top: member.y - badgeOverhang,
    right: member.x + width,
    bottom: member.y + bodyHeight,
    width,
    height: bodyHeight + badgeOverhang,
  };
}

/** True when boxes intersect or edges touch within `gap` pixels. */
export function cardBoxesCollide(a: CardBBox, b: CardBBox, gap = MIN_CARD_GAP): boolean {
  return !(
    a.right + gap <= b.left
    || b.right + gap <= a.left
    || a.bottom + gap <= b.top
    || b.bottom + gap <= a.top
  );
}

export function measureMembersBounds(members: PositionedMember[]) {
  if (members.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  members.forEach((member) => {
    const box = memberCardBBox(member);
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  });

  return { minX, minY, maxX, maxY };
}
