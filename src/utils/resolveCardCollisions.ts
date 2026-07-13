import type { PositionedMember } from './computeCanopyLayout';
import {
  getCardDimensions,
  isFounderMember,
  LAYOUT_GAPS,
  OVERLAY_BOUNDS,
} from './cardLayoutMetrics';

interface PixelCard {
  id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  fatherId: number | null;
  generation: number;
}

const MAX_ITERATIONS = 100;

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function branchRootId(member: PositionedMember, byId: Map<number, PositionedMember>): number {
  let current: PositionedMember | undefined = member;
  while (current?.fatherId != null) {
    const parent = byId.get(current.fatherId);
    if (!parent) break;
    if (parent.fatherId == null || parent.generation <= 2) {
      return parent.id;
    }
    current = parent;
  }
  return member.id;
}

function minGapForPair(a: PixelCard, b: PixelCard, byId: Map<number, PositionedMember>): {
  horizontal: number;
  vertical: number;
} {
  if (a.fatherId === b.id || b.fatherId === a.id) {
    return { horizontal: LAYOUT_GAPS.siblingHorizontal, vertical: LAYOUT_GAPS.parentChildVertical };
  }

  if (a.fatherId != null && a.fatherId === b.fatherId) {
    return { horizontal: LAYOUT_GAPS.siblingHorizontal, vertical: LAYOUT_GAPS.minVertical };
  }

  const memberA = byId.get(a.id);
  const memberB = byId.get(b.id);
  if (!memberA || !memberB) {
    return { horizontal: LAYOUT_GAPS.minHorizontal, vertical: LAYOUT_GAPS.minVertical };
  }

  const rootA = branchRootId(memberA, byId);
  const rootB = branchRootId(memberB, byId);
  if (rootA !== rootB) {
    return { horizontal: LAYOUT_GAPS.branchZoneGap, vertical: LAYOUT_GAPS.minVertical };
  }

  return { horizontal: LAYOUT_GAPS.minHorizontal, vertical: LAYOUT_GAPS.minVertical };
}

function toPixelCards(
  members: PositionedMember[],
  overlayW: number,
  overlayH: number,
): PixelCard[] {
  return members.map((member) => {
    const dims = getCardDimensions(isFounderMember(member));
    return {
      id: member.id,
      cx: (member.x / 100) * overlayW,
      cy: (member.y / 100) * overlayH,
      w: dims.width,
      h: dims.footprintH,
      fatherId: member.fatherId,
      generation: member.generation,
    };
  });
}

function pixelToPercent(
  cards: PixelCard[],
  overlayW: number,
  overlayH: number,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  cards.forEach((card) => {
    out.set(card.id, {
      x: clampPercent((card.cx / overlayW) * 100, OVERLAY_BOUNDS.minX, OVERLAY_BOUNDS.maxX),
      y: clampPercent((card.cy / overlayH) * 100, OVERLAY_BOUNDS.minY, OVERLAY_BOUNDS.maxY),
    });
  });
  return out;
}

function separationNeeded(
  a: PixelCard,
  b: PixelCard,
  byId: Map<number, PositionedMember>,
): { dx: number; dy: number } {
  const deltaX = b.cx - a.cx;
  const deltaY = b.cy - a.cy;
  const gaps = minGapForPair(a, b, byId);
  const overlapX = (a.w + b.w) / 2 + gaps.horizontal - Math.abs(deltaX);
  const overlapY = (a.h + b.h) / 2 + gaps.vertical - Math.abs(deltaY);

  if (overlapX <= 0 || overlapY <= 0) {
    return { dx: 0, dy: 0 };
  }

  if (overlapX <= overlapY) {
    const dir = deltaX === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(deltaX);
    return { dx: dir * overlapX * 0.52, dy: 0 };
  }

  const dir = deltaY === 0 ? -1 : Math.sign(deltaY);
  return { dx: 0, dy: dir * overlapY * 0.52 };
}

function clampCardsToOverlay(
  cards: PixelCard[],
  overlayW: number,
  overlayH: number,
): void {
  cards.forEach((card) => {
    const halfW = card.w / 2;
    const halfH = card.h / 2;
    const minCx = (OVERLAY_BOUNDS.minX / 100) * overlayW + halfW;
    const maxCx = (OVERLAY_BOUNDS.maxX / 100) * overlayW - halfW;
    const minCy = (OVERLAY_BOUNDS.minY / 100) * overlayH + halfH;
    const maxCy = (OVERLAY_BOUNDS.maxY / 100) * overlayH - halfH;
    card.cx = Math.min(maxCx, Math.max(minCx, card.cx));
    card.cy = Math.min(maxCy, Math.max(minCy, card.cy));
  });
}

function runCollisionPasses(
  cards: PixelCard[],
  members: PositionedMember[],
  overlayW: number,
  overlayH: number,
): void {
  const byId = new Map(members.map((member) => [member.id, member]));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let moved = false;

    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const { dx, dy } = separationNeeded(cards[i], cards[j], byId);
        if (dx === 0 && dy === 0) continue;

        cards[i].cx -= dx;
        cards[i].cy -= dy;
        cards[j].cx += dx;
        cards[j].cy += dy;
        moved = true;
      }
    }

    clampCardsToOverlay(cards, overlayW, overlayH);

    if (!moved) break;
  }
}

/** Resolve overlaps in pixel space then return updated percent positions. */
export function resolveCardCollisions(
  members: PositionedMember[],
  overlayW: number,
  overlayH: number,
): PositionedMember[] {
  if (overlayW <= 0 || overlayH <= 0) return members;

  const cards = toPixelCards(members, overlayW, overlayH);
  runCollisionPasses(cards, members, overlayW, overlayH);

  const positions = pixelToPercent(cards, overlayW, overlayH);
  return members.map((member) => {
    const pos = positions.get(member.id);
    return pos ? { ...member, x: pos.x, y: pos.y } : member;
  });
}

/** DOM pass: measure rendered cards and resolve any remaining overlap. */
export function resolveCollisionsFromDom(
  members: PositionedMember[],
  overlayEl: HTMLElement,
  membersEl: HTMLElement,
): PositionedMember[] {
  const overlayRect = overlayEl.getBoundingClientRect();
  if (overlayRect.width <= 0 || overlayRect.height <= 0) return members;

  const cards: PixelCard[] = [];

  members.forEach((member) => {
    const cardEl = membersEl.querySelector<HTMLElement>(`.card[data-id="${member.id}"]`);
    if (!cardEl) return;

    const rect = cardEl.getBoundingClientRect();
    cards.push({
      id: member.id,
      cx: rect.left - overlayRect.left + rect.width / 2,
      cy: rect.top - overlayRect.top + rect.height / 2,
      w: rect.width,
      h: rect.height,
      fatherId: member.fatherId,
      generation: member.generation,
    });
  });

  if (cards.length === 0) return members;

  runCollisionPasses(cards, members, overlayRect.width, overlayRect.height);

  const positions = pixelToPercent(cards, overlayRect.width, overlayRect.height);
  return members.map((member) => {
    const pos = positions.get(member.id);
    return pos ? { ...member, x: pos.x, y: pos.y } : member;
  });
}
