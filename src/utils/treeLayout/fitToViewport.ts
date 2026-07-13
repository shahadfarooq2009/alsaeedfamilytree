/** Padding around fitted tree content inside the viewport (px). */
export const FIT_VIEWPORT_PADDING = 28;

/** Minimum zoom when the user zooms manually. */
export const FIT_MIN_ZOOM = 0.85;

/** Maximum zoom when the user zooms manually. */
export const FIT_MAX_ZOOM = 1.5;

/** Auto-fit may shrink very large trees until everything fits on screen. */
export const AUTO_FIT_MIN_ZOOM = 0.01;

/** Keep tree clear of the header and bottom toolbar. */
export const FIT_SAFE_AREA = {
  top: 96,
  right: 36,
  bottom: 92,
  left: 36,
} as const;

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
  return Math.max(AUTO_FIT_MIN_ZOOM, Math.min(FIT_MAX_ZOOM, raw));
}

export function computeFitPanZoom(
  bounds: BoundsRect,
  viewportWidth: number,
  viewportHeight: number,
): { scale: number; panX: number; panY: number } {
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const availW = Math.max(1, viewportWidth - FIT_SAFE_AREA.left - FIT_SAFE_AREA.right);
  const availH = Math.max(1, viewportHeight - FIT_SAFE_AREA.top - FIT_SAFE_AREA.bottom);
  const scaleX = availW / contentW;
  const scaleY = availH / contentH;
  const rawScale = Math.min(scaleX, scaleY);
  const scale = Number.isFinite(rawScale) && rawScale > 0
    ? Math.min(FIT_MAX_ZOOM, Math.max(AUTO_FIT_MIN_ZOOM, rawScale))
    : AUTO_FIT_MIN_ZOOM;
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;

  return {
    scale,
    panX: FIT_SAFE_AREA.left + (availW - scaledW) / 2 - bounds.minX * scale,
    panY: FIT_SAFE_AREA.top + (availH - scaledH) / 2 - bounds.minY * scale,
  };
}

export function isPanZoomViewFullyVisible(
  view: { scale: number; panX: number; panY: number },
  bounds: BoundsRect,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const left = view.panX + bounds.minX * view.scale;
  const top = view.panY + bounds.minY * view.scale;
  const right = view.panX + bounds.maxX * view.scale;
  const bottom = view.panY + bounds.maxY * view.scale;
  const tolerance = 4;

  return (
    left >= FIT_SAFE_AREA.left - tolerance
    && top >= FIT_SAFE_AREA.top - tolerance
    && right <= viewportWidth - FIT_SAFE_AREA.right + tolerance
    && bottom <= viewportHeight - FIT_SAFE_AREA.bottom + tolerance
  );
}
