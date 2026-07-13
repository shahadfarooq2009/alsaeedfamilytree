import { getLayoutScale } from './layoutScaleContext';
import {
  cardHeightForMemberFromScale,
  cardWidthForMemberFromScale,
} from './cardSizing';

export function hasParentLink(member: { fatherId: number | null; motherId?: number | null }): boolean {
  return member.fatherId != null || member.motherId != null;
}

/** Tree root / founder — VIP card. Not used for mother-linked children. */
export function isFounderMember(member: {
  fatherId: number | null;
  motherId?: number | null;
  generation?: number;
}): boolean {
  return !hasParentLink(member);
}

export function primaryParentId(member: {
  fatherId: number | null;
  motherId?: number | null;
}): number | null {
  return member.fatherId ?? member.motherId ?? null;
}

/** Badge circle extends above card top. */
export function getBadgeOverhang(): number {
  return getLayoutScale().badgeOverhang;
}

export function getFounderBadgeOverhang(): number {
  return getLayoutScale().founderBadgeOverhang;
}

/** Fixed reference card width by generation. */
export function cardWidthForMember(member: {
  fatherId: number | null;
  generation: number;
  fullName: string;
}): number {
  return cardWidthForMemberFromScale(member);
}

export function cardHeightForMember(member: { fatherId: number | null; generation: number }): number {
  return cardHeightForMemberFromScale(member);
}

export function cardFootprintForMember(member: { fatherId: number | null; generation: number }): number {
  const scale = getLayoutScale();
  if (isFounderMember(member)) {
    return cardHeightForMemberFromScale(member) + scale.founderBadgeOverhang;
  }
  return cardHeightForMemberFromScale(member) + scale.badgeOverhang;
}

export function getSiblingGap(): number {
  return getLayoutScale().siblingGap;
}

export function getBranchGap(): number {
  return getLayoutScale().branchGap;
}

export function getFamilyGroupGap(): number {
  return getLayoutScale().familyGroupGap;
}

export function getGenerationGap(): number {
  return getLayoutScale().generationGap;
}

export function getFounderChildGap(): number {
  return getLayoutScale().founderChildGap;
}

export function getConnectorChildDrop(): number {
  return getLayoutScale().connectorChildDrop;
}

export const CONNECTOR_ROOT_CURVE_BLEND = 0.92;

export function getBranchZonePadding(): number {
  return getLayoutScale().branchZonePadding;
}

export function getCanvasPadding(): number {
  return getLayoutScale().canvasPadding;
}

export function getMinCanvasWidth(): number {
  return getLayoutScale().minCanvasWidth;
}

export function getMinCanvasHeight(): number {
  return getLayoutScale().minCanvasHeight;
}

export function getMinBranchSeparation(): number {
  return getLayoutScale().minBranchSeparation;
}

/** @deprecated Use cardWidthForMember */
export const CARD_WIDTH = 96;
/** @deprecated */
export const CARD_HEIGHT = 66;
/** @deprecated */
export const SIBLING_GAP = 22;
/** @deprecated */
export const FAMILY_GROUP_GAP = 34;
/** @deprecated */
export const GENERATION_GAP = 108;
/** @deprecated */
export const FOUNDER_CHILD_GAP = 118;
/** @deprecated */
export const BADGE_OVERHANG = 12;
/** @deprecated */
export const FOUNDER_CARD_FOOTPRINT_H = 90;
/** @deprecated */
export const CARD_FOOTPRINT_H = 78;
/** @deprecated */
export const CONNECTOR_CHILD_DROP = 8;
/** @deprecated */
export const BRANCH_ZONE_PADDING = 8;
/** @deprecated */
export const CANVAS_PADDING = 80;
/** @deprecated */
export const MIN_CANVAS_WIDTH = 1200;
/** @deprecated */
export const MIN_CANVAS_HEIGHT = 900;
/** @deprecated */
export const MIN_BRANCH_SEPARATION = 18;

/** @deprecated Use cardWidthForMember */
export function cardWidthForGeneration(generation: number): number {
  void generation;
  return getLayoutScale().cardWidth;
}

/** @deprecated Use cardHeightForMember */
export function cardHeightForGeneration(generation: number): number {
  void generation;
  return getLayoutScale().cardHeight;
}

/** @deprecated Use cardFootprintForMember */
export function cardFootprintForGeneration(generation: number): number {
  void generation;
  return getLayoutScale().cardHeight + getLayoutScale().badgeOverhang;
}
