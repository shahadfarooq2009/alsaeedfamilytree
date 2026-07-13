/**
 * Polar / canopy layout calibration.
 * Angles are radians from vertical-up (0 = straight up, + = clockwise/right).
 */
export const canopyPolar = {
  /** Hub sits above the founder — canopy radiates from here. */
  hubOffsetAboveFounder: 300,

  /** Radius from hub for each tree depth. */
  radiusByDepth: [0, 420, 580, 720, 830] as const,

  /** Extra radius per depth beyond index 4. */
  deepRadiusStep: 95,

  /** Total arc span for generation-1 (radians). ~158° */
  gen1ArcSpan: Math.PI * 0.88,

  /** Child wedge shrinks by this factor each generation. */
  wedgeShrinkPerGen: 0.78,

  /** Minimum |sin(angle)| so nodes don't stack on trunk centerline. */
  minSinAngle: 0.18,

  /** Small angular jitter for organic feel (radians). */
  angleJitter: 0.04,

  /** Radius jitter (px). */
  radiusJitter: 12,
} as const;

export function radiusForDepth(depth: number): number {
  const table = canopyPolar.radiusByDepth;
  if (depth < table.length) {
    return table[depth];
  }

  const last = table[table.length - 1];
  return last + (depth - (table.length - 1)) * canopyPolar.deepRadiusStep;
}
