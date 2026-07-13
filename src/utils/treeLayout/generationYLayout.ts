import { referenceComposition } from '../referenceComposition';
import { cardFootprintForMember } from './constants';
import type { LayoutTreeNode } from './types';

/** Reference PNG world height used for depth calibration. */
const REFERENCE_WORLD_HEIGHT = 1800;

/** Upper canopy margin — generation rows spread across full viewport height. */
export const CANOPY_TOP_FRACTION = 0.1;

/** Lower trunk margin — founder anchored near bottom trunk. */
export const CANOPY_BOTTOM_FRACTION = 0.9;

export function maxGenerationFromMembers(members: { generation: number }[]): number {
  if (members.length === 0) return 1;
  return Math.max(1, ...members.map((member) => member.generation));
}

export function maxGenerationFromTree(roots: LayoutTreeNode[]): number {
  let maxGen = 1;

  const walk = (node: LayoutTreeNode): void => {
    maxGen = Math.max(maxGen, node.generation);
    node.children.forEach(walk);
  };

  roots.forEach(walk);
  return maxGen;
}

/**
 * Compact vertical rows — fixed generation gap, no empty virtual canvas height.
 */
export function applyCompactYByTreeDepth(
  roots: LayoutTreeNode[],
  topMargin: number,
  generationGap: number,
): number {
  let maxDepth = 1;

  const measure = (node: LayoutTreeNode, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    node.children.forEach((child) => measure(child, depth + 1));
  };

  const assign = (node: LayoutTreeNode, depth: number): void => {
    node.y = Math.round(topMargin + (maxDepth - depth) * generationGap);
    node.children.forEach((child) => assign(child, depth + 1));
  };

  roots.forEach((root) => measure(root, 1));
  roots.forEach((root) => assign(root, 1));
  return maxDepth;
}

/**
 * @deprecated Use applyCompactYByTreeDepth for fit-to-viewport layouts.
 */
export function generationYForGeneration(
  generation: number,
  canvasHeight: number,
  maxGeneration: number,
): number {
  const gen = Math.max(1, Math.min(generation, maxGeneration));

  if (maxGeneration <= 1) {
    return Math.round(canvasHeight * CANOPY_BOTTOM_FRACTION);
  }

  const usableTop = canvasHeight * CANOPY_TOP_FRACTION;
  const usableBottom = canvasHeight * CANOPY_BOTTOM_FRACTION;
  const generationStep = (usableBottom - usableTop) / (maxGeneration - 1);

  return Math.round(usableBottom - (gen - 1) * generationStep);
}

/**
 * @deprecated Use applyCompactYByTreeDepth for fit-to-viewport layouts.
 */
/** Map tree depth to reference image Y (founder depth=1 → ref depth 0 at bottom). */
export function referenceCardTopY(
  treeDepth: number,
  canvasHeight: number,
  footprint: number,
): number {
  const refDepth = Math.max(0, treeDepth - 1);
  const scale = canvasHeight / REFERENCE_WORLD_HEIGHT;
  const fromBottom = refDepth in referenceComposition.depthFromBottom
    ? referenceComposition.depthFromBottom[refDepth]
    : referenceComposition.depthFromBottom[3]
      + (refDepth - 3) * referenceComposition.deepDepthSpacing;

  return Math.round(canvasHeight - fromBottom * scale - footprint);
}

/** Generation rows aligned to family-tree-reference.png depth bands. */
export function applyReferenceCanopyYByTreeDepth(
  roots: LayoutTreeNode[],
  canvasHeight: number,
): number {
  let maxDepth = 1;

  const measure = (node: LayoutTreeNode, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    node.children.forEach((child) => measure(child, depth + 1));
  };

  const assign = (node: LayoutTreeNode, depth: number): void => {
    const footprint = cardFootprintForMember(node);
    node.y = referenceCardTopY(depth, canvasHeight, footprint);
    node.children.forEach((child) => assign(child, depth + 1));
  };

  roots.forEach((root) => measure(root, 1));
  roots.forEach((root) => assign(root, 1));
  return maxDepth;
}

export function applyCanopyYByTreeDepth(
  roots: LayoutTreeNode[],
  canvasHeight: number,
): number {
  let maxDepth = 1;

  const measure = (node: LayoutTreeNode, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    node.children.forEach((child) => measure(child, depth + 1));
  };

  const assign = (node: LayoutTreeNode, depth: number): void => {
    node.y = generationYForGeneration(depth, canvasHeight, maxDepth);
    node.children.forEach((child) => assign(child, depth + 1));
  };

  roots.forEach((root) => measure(root, 1));
  roots.forEach((root) => assign(root, 1));
  return maxDepth;
}

/** Canvas height from compact row spacing — tight, no reserved empty bands. */
export function computeCompactCanvasHeight(
  maxDepth: number,
  generationGap: number,
  cardFootprint: number,
  padding: number,
): number {
  if (maxDepth <= 1) return padding * 2 + cardFootprint;
  return padding * 2 + (maxDepth - 1) * generationGap + cardFootprint;
}

export interface GenerationLayoutDiagnostics {
  maxGeneration: number;
  generationGap: number;
  generationScale: number;
  canvasHeight: number;
  contentHeight: number;
  verticalOffsetApplied: number;
  yByGeneration: Record<number, number>;
}

export function buildGenerationLayoutDiagnostics(
  members: { generation: number; y: number }[],
  canvasHeight: number,
  generationGap: number,
  verticalOffset = 0,
): GenerationLayoutDiagnostics {
  const maxGeneration = maxGenerationFromMembers(members);
  const yByGeneration: Record<number, number> = {};

  members.forEach((member) => {
    if (yByGeneration[member.generation] == null) {
      yByGeneration[member.generation] = member.y;
    }
  });

  const ys = members.map((member) => member.y);
  const contentHeight = ys.length > 0 ? Math.max(...ys) - Math.min(...ys) : 0;

  return {
    maxGeneration,
    generationGap,
    generationScale: generationGap,
    canvasHeight,
    contentHeight,
    verticalOffsetApplied: verticalOffset,
    yByGeneration,
  };
}
