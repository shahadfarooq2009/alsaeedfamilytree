/** Padding around fitted tree content inside the viewport (px). */
export const FIT_VIEWPORT_PADDING = 28;

export const FIT_MIN_ZOOM = 0.45;
export const FIT_MAX_ZOOM = 1.5;

export interface BoundsRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsSize(bounds: BoundsRect): { width: number; height: number } {
  return {
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
}

/** Estimate raw zoom before clamping — used to decide if layout must compact further. */
export function estimateRawFitScale(
  bounds: BoundsRect,
  viewportWidth: number,
  viewportHeight: number,
  padding = FIT_VIEWPORT_PADDING,
): number {
  const { width, height } = boundsSize(bounds);
  const scaleX = (viewportWidth - padding * 2) / width;
  const scaleY = (viewportHeight - padding * 2) / height;
  return Math.min(scaleX, scaleY);
}

/** Estimate zoom needed to fit bounds into viewport with padding. */
export function estimateFitScale(
  bounds: BoundsRect,
  viewportWidth: number,
  viewportHeight: number,
  padding = FIT_VIEWPORT_PADDING,
): number {
  const raw = estimateRawFitScale(bounds, viewportWidth, viewportHeight, padding);
  return Math.max(FIT_MIN_ZOOM, Math.min(FIT_MAX_ZOOM, raw));
}
