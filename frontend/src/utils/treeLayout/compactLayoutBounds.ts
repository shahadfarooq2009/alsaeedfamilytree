import { measureMembersBounds } from './cardBounds';
import { FIT_VIEWPORT_PADDING } from './fitToViewport';
import type { PositionedMember } from './types';

export const LAYOUT_CONTENT_PADDING = FIT_VIEWPORT_PADDING;

export function normalizeMembersToContentOrigin(
  members: PositionedMember[],
  padding = LAYOUT_CONTENT_PADDING,
): {
  members: PositionedMember[];
  contentBounds: ReturnType<typeof measureMembersBounds>;
  canvasWidth: number;
  canvasHeight: number;
} {
  if (members.length === 0) {
    return {
      members: [],
      contentBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      canvasWidth: padding * 2,
      canvasHeight: padding * 2,
    };
  }

  const bounds = measureMembersBounds(members);
  const dx = padding - bounds.minX;
  const dy = padding - bounds.minY;
  const normalized = members.map((member) => ({
    ...member,
    x: member.x + dx,
    y: member.y + dy,
  }));

  const contentBounds = measureMembersBounds(normalized);

  return {
    members: normalized,
    contentBounds,
    canvasWidth: Math.ceil(contentBounds.maxX + padding),
    canvasHeight: Math.ceil(contentBounds.maxY + padding),
  };
}
