/** Fixed card dimensions used for layout and collision resolution (px). */
export const CARD_REGULAR = {
  width: 96,
  height: 66,
  /** Total vertical footprint including badge overhang. */
  footprintH: 78,
} as const;

export const CARD_FOUNDER = {
  width: 118,
  height: 76,
  footprintH: 90,
} as const;

export const LAYOUT_GAPS = {
  minHorizontal: 18,
  minVertical: 26,
  siblingHorizontal: 18,
  clusterHorizontal: 28,
  /** Minimum gap between unrelated branch zone edges (px). */
  branchZoneGap: 44,
  /** Vertical space between parent card and child cluster (px). */
  parentChildVertical: 18,
  /** Extra reserved sibling slots per branch for future members. */
  reserveSiblingSlots: 2,
} as const;

/** Fixed vertical bands (% of overlay height) per generation tier. */
export const GENERATION_Y: Record<number, number> = {
  1: 78,
  2: 56,
  3: 30,
  4: 15,
};

export const OVERLAY_BOUNDS = {
  minX: 12,
  maxX: 88,
  minY: 10,
  maxY: 88,
} as const;

export function getCardDimensions(isFounder: boolean) {
  return isFounder ? CARD_FOUNDER : CARD_REGULAR;
}

export function isFounderMember(member: {
  fatherId: number | null;
  motherId?: number | null;
  generation: number;
}) {
  return member.fatherId == null && (member.motherId == null || member.motherId === undefined);
}
