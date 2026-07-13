import { measureMembersBounds } from './cardBounds';
import { isFounderMember } from './constants';
import { cardWidthForMember } from './constants';
import { usableStageRect, type LayoutStage } from './stageBounds';
import type { PositionedMember } from './types';

/** Remap node positions so content fills the usable stage area. */
export function normalizeMembersToStage(
  members: PositionedMember[],
  stage: LayoutStage,
): PositionedMember[] {
  if (members.length === 0) return members;

  const usable = usableStageRect(stage);
  const bounds = measureMembersBounds(members);
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);

  const scaleX = usable.width / contentW;
  const scaleY = usable.height / contentH;

  let normalized = members.map((member) => ({
    ...member,
    x: usable.left + (member.x - bounds.minX) * scaleX,
    y: usable.top + (member.y - bounds.minY) * scaleY,
  }));

  const founder = normalized.find((m) => isFounderMember(m));
  if (founder) {
    const founderCenter = founder.x + cardWidthForMember(founder) / 2;
    const dx = stage.width / 2 - founderCenter;
    normalized = normalized.map((m) => ({ ...m, x: m.x + dx }));

    const afterBounds = measureMembersBounds(normalized);
    const bottomDy = usable.bottom - afterBounds.maxY;
    if (bottomDy !== 0) {
      normalized = normalized.map((m) => ({ ...m, y: m.y + bottomDy }));
    }
  }

  return normalized;
}

/** Clamp all card boxes inside the usable stage (post-collision). */
export function clampMembersToStage(
  members: PositionedMember[],
  stage: LayoutStage,
): PositionedMember[] {
  const usable = usableStageRect(stage);
  const bounds = measureMembersBounds(members);
  const overflowLeft = usable.left - bounds.minX;
  const overflowRight = bounds.maxX - usable.right;
  const overflowTop = usable.top - bounds.minY;
  const overflowBottom = bounds.maxY - usable.bottom;

  let dx = 0;
  let dy = 0;
  const epsilon = 0.5;

  if (overflowLeft > epsilon) dx += overflowLeft;
  if (overflowRight > epsilon) dx -= overflowRight;
  if (overflowTop > epsilon) dy += overflowTop;
  if (overflowBottom > epsilon) dy -= overflowBottom;

  if (dx === 0 && dy === 0) return members;
  return members.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy }));
}
