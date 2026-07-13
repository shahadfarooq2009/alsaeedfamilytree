import type { PositionedLink } from '../types/tree';

/** Natural leaf tilt from parent→child branch direction. */
export function computeNodeTilts(links: PositionedLink[]): Map<number, number> {
  const tilts = new Map<number, number>();

  links.forEach((link) => {
    const dx = link.target.worldX - link.source.worldX;
    const dy = link.target.worldY - link.source.worldY;
    const angleRad = Math.atan2(dx, -dy);
    const tiltDeg = (angleRad * 180) / Math.PI;
    const damped = Math.max(-32, Math.min(32, tiltDeg * 0.55));
    tilts.set(link.target.id, damped);
  });

  return tilts;
}
