import type { TreePersonNode } from '../types/tree';
import { referenceComposition } from './referenceComposition';

/** Shared SVG world coordinate space — wide canopy for botanical composition. */
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 1800;

/** Landscape trunk native aspect (height / width). */
export const TRUNK_ASPECT = 941 / 1672;

/** Trunk width fraction — calibrated to reference. */
export const TRUNK_WIDTH_FRAC = referenceComposition.trunkWidthFrac;

/** Distance from world bottom to founder node center. */
export const BOTTOM_MARGIN = referenceComposition.founderBottomMargin;

export type TreeDensityMode = 'compact' | 'medium' | 'large';

export function getTreeDensityMode(nodeCount: number): TreeDensityMode {
  if (nodeCount < 6) return 'compact';
  if (nodeCount <= 25) return 'medium';
  return 'large';
}

/** Fixed vertical world-Y per tree depth (founder = 0). */
export const DEPTH_WORLD_Y: Record<number, number> = {
  0: WORLD_HEIGHT - referenceComposition.depthFromBottom[0],
  1: WORLD_HEIGHT - referenceComposition.depthFromBottom[1],
  2: WORLD_HEIGHT - referenceComposition.depthFromBottom[2],
  3: WORLD_HEIGHT - referenceComposition.depthFromBottom[3],
};

/** Reduced vertical spacing for depth 4+. */
export const DEPTH_Y_SPACING_DEEP = referenceComposition.deepDepthSpacing;

/** Horizontal child spacing by parent depth. */
export const CHILD_SPACING_BY_DEPTH: Record<number, number> = {
  0: 220,
  1: 195,
  2: 165,
  3: 140,
};

/** @deprecated Use WORLD_WIDTH */
export const CANVAS_WIDTH = WORLD_WIDTH;
/** @deprecated Use WORLD_HEIGHT */
export const CANVAS_HEIGHT = WORLD_HEIGHT;
/** @deprecated Use BOTTOM_MARGIN */
export const BOTTOM_OFFSET = BOTTOM_MARGIN;

const BASE_NODE_SIZES = {
  founder: { width: 148, height: referenceComposition.nodeHeights.founder },
  generation1: { width: 98, height: referenceComposition.nodeHeights.generation1 },
  generation2: { width: 82, height: referenceComposition.nodeHeights.generation2 },
  generation3: { width: 72, height: referenceComposition.nodeHeights.generation3 },
  default: { width: 66, height: referenceComposition.nodeHeights.default },
} as const;

/** Horizontal band (fraction of WORLD_WIDTH) allowed per depth. */
export const DEPTH_X_BAND: Record<number, [number, number]> = {
  0: [0.5, 0.5],
  1: [0.03, 0.97],
  2: [0.02, 0.98],
  3: [0.01, 0.99],
};

export const DEPTH_X_BAND_DEEP: [number, number] = [0.01, 0.99];

/** Minimum distance from trunk center line for non-founder nodes. */
export const TRUNK_CENTER_EXCLUSION = 145;

/** Canopy anchor fractions for generation-1 (far left → far right). */
export const GEN1_CANOPY_ANCHORS = referenceComposition.gen1Anchors;

function getDensityNodeScale(mode: TreeDensityMode): number {
  if (mode === 'compact') return 1.08;
  if (mode === 'medium') return 1;
  return 0.88;
}

let activeDensityMode: TreeDensityMode = 'medium';

/** Called by layout before measuring nodes. */
export function setLayoutDensityMode(mode: TreeDensityMode): void {
  activeDensityMode = mode;
}

export function getNodeWidth(data: TreePersonNode): number {
  const scale = getDensityNodeScale(activeDensityMode);
  let base: number;

  if (data.generation_number === 0 || data.is_family_head) {
    base = BASE_NODE_SIZES.founder.width;
  } else if (data.generation_number === 1) {
    base = BASE_NODE_SIZES.generation1.width;
  } else if (data.generation_number === 2) {
    base = BASE_NODE_SIZES.generation2.width;
  } else if (data.generation_number === 3) {
    base = BASE_NODE_SIZES.generation3.width;
  } else {
    base = BASE_NODE_SIZES.default.width;
  }

  return Math.round(base * scale);
}

export function getNodeHeight(data: TreePersonNode): number {
  const scale = getDensityNodeScale(activeDensityMode);
  let base: number;

  if (data.generation_number === 0 || data.is_family_head) {
    base = BASE_NODE_SIZES.founder.height;
  } else if (data.generation_number === 1) {
    base = BASE_NODE_SIZES.generation1.height;
  } else if (data.generation_number === 2) {
    base = BASE_NODE_SIZES.generation2.height;
  } else if (data.generation_number === 3) {
    base = BASE_NODE_SIZES.generation3.height;
  } else {
    base = BASE_NODE_SIZES.default.height;
  }

  return Math.round(base * scale);
}

export function getDepthWorldY(depth: number): number {
  if (depth in DEPTH_WORLD_Y) {
    return DEPTH_WORLD_Y[depth];
  }

  const base = DEPTH_WORLD_Y[3];
  return base - (depth - 3) * DEPTH_Y_SPACING_DEEP;
}

export function getDepthXBand(depth: number): { minX: number; maxX: number } {
  if (depth === 0) {
    return { minX: WORLD_WIDTH / 2, maxX: WORLD_WIDTH / 2 };
  }

  const band = depth >= 4 ? DEPTH_X_BAND_DEEP : DEPTH_X_BAND[depth] ?? DEPTH_X_BAND_DEEP;
  const mode = activeDensityMode;

  if (depth === 1 && mode === 'compact') {
    const inset = 0.16;
    return {
      minX: WORLD_WIDTH * inset,
      maxX: WORLD_WIDTH * (1 - inset),
    };
  }

  return { minX: WORLD_WIDTH * band[0], maxX: WORLD_WIDTH * band[1] };
}

export function getChildSpacing(parentDepth: number): number {
  const base = CHILD_SPACING_BY_DEPTH[parentDepth] ?? 110;
  if (activeDensityMode === 'compact') return base * 0.82;
  if (activeDensityMode === 'large') return base * 1.08;
  return base;
}

/** Decorative trunk extent for fit-to-screen bounds. */
export function getTrunkWorldBounds() {
  const cx = WORLD_WIDTH / 2;
  const trunkW = WORLD_WIDTH * TRUNK_WIDTH_FRAC;
  const trunkH = trunkW * TRUNK_ASPECT;
  const baseY = WORLD_HEIGHT;
  const canopyTop = WORLD_HEIGHT * 0.04;

  return {
    minX: cx - trunkW * 0.72,
    maxX: cx + trunkW * 0.72,
    minY: Math.min(baseY - trunkH - 60, canopyTop),
    maxY: baseY + 28,
  };
}

export const TREE_NODE_WIDTH = 220;
export const TREE_NODE_HEIGHT = 180;
