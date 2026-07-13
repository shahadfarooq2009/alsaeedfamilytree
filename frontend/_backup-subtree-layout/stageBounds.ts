/** Usable layout area inside the family-tree viewport stage. */
export interface StageBounds {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  minGap: number;
  usableLeft: number;
  usableRight: number;
  usableTop: number;
  usableBottom: number;
}

export const DEFAULT_STAGE = { width: 1600, height: 900 } as const;

export const MIN_CARD_GAP = 10;

export function createStageBounds(
  width: number,
  height: number,
  minGap = MIN_CARD_GAP,
): StageBounds {
  const safeWidth = Math.max(320, Math.round(width));
  const safeHeight = Math.max(240, Math.round(height));
  const paddingX = Math.max(28, Math.round(safeWidth * 0.035));
  const paddingY = Math.max(24, Math.round(safeHeight * 0.035));

  return {
    width: safeWidth,
    height: safeHeight,
    paddingX,
    paddingY,
    minGap,
    usableLeft: paddingX,
    usableRight: safeWidth - paddingX,
    usableTop: paddingY,
    usableBottom: safeHeight - paddingY,
  };
}
