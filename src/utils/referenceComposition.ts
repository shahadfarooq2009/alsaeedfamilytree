/**
 * Visual calibration targets derived from family-tree-reference.png.
 * Used for layout, scale, and UI placement — not as a rendered background.
 */
export const referenceComposition = {
  /** Tree should fill ~88–94% of viewport on initial fit. */
  fitPadding: 0.94,

  /** Founder vertical offset from world bottom (px). */
  founderBottomMargin: 95,

  /** Central trunk width as fraction of world width. */
  trunkWidthFrac: 0.38,

  /** Where main limbs emerge on trunk (fraction from trunk bottom). */
  trunkCrownFrac: 0.58,

  /** Generation depth Y offsets from world bottom (reference PNG — 6 tiers). */
  depthFromBottom: {
    0: 95,
    1: 260,
    2: 480,
    3: 680,
    4: 820,
    5: 960,
  } as Record<number, number>,

  deepDepthSpacing: 105,

  /** Generation-1 horizontal anchors (far left → far right). */
  gen1Anchors: [0.07, 0.24, 0.42, 0.58, 0.76, 0.93] as const,

  /** Node base sizes (height px) — reference proportions. */
  nodeHeights: {
    founder: 168,
    generation1: 112,
    generation2: 92,
    generation3: 78,
    default: 72,
  } as const,

  /** Foliage density multipliers by family size. */
  foliage: {
    compact: { perLink: 4, perNode: 2, ambient: 8 },
    medium: { perLink: 7, perNode: 3, ambient: 16 },
    large: { perLink: 10, perNode: 4, ambient: 24 },
  } as const,
} as const;

export function getReferenceDepthY(
  depth: number,
  worldHeight: number,
): number {
  const table = referenceComposition.depthFromBottom;

  if (depth in table) {
    return worldHeight - table[depth];
  }

  const base = worldHeight - table[3];
  const extra = depth - 3;
  return base - extra * referenceComposition.deepDepthSpacing;
}
