/** Minimum rendered card dimensions — never shrink below these. */
export const MIN_CARD_WIDTH = 58;
export const MIN_CARD_HEIGHT = 38;
export const MIN_FONT_SIZE = 8;
export const MIN_BADGE_SIZE = 15;

/** Compact layout spacing. */
export const SIBLING_GAP = 8;
export const SUBTREE_GAP = 14;
export const MAIN_BRANCH_GAP = 20;
export const GENERATION_GAP = 76;

/** Safe padding around the complete tree composition. */
export const SAFE_PADDING_X = 60;
export const SAFE_PADDING_Y = 50;

/** Extra margin for card shadows in bounds calculation. */
export const SHADOW_PADDING = 8;

/** Target viewport fill on initial fit. */
export const FIT_WIDTH_RATIO = 0.9;
export const FIT_HEIGHT_RATIO = 0.85;

/** Minimum viewport zoom when manually zooming out. */
export const MIN_READABLE_SCALE = 0.75;

export function clampCardWidth(width: number): number {
  return Math.max(MIN_CARD_WIDTH, Math.round(width));
}

export function clampCardHeight(height: number): number {
  return Math.max(MIN_CARD_HEIGHT, Math.round(height));
}

export function clampBadgeSize(size: number, cardWidth: number): number {
  return Math.max(
    MIN_BADGE_SIZE,
    Math.min(size, Math.round(cardWidth * 0.42)),
  );
}

export function clampFontSize(size: number): number {
  return Math.max(MIN_FONT_SIZE, Math.round(size));
}
