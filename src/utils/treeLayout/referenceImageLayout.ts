import { referenceComposition } from '../referenceComposition';
import { generationYForGeneration } from './generationYLayout';

/** Reference map canvas — matches family-tree-reference.png proportions. */
export const REFERENCE_CANVAS_WIDTH = 1600;
export const REFERENCE_CANVAS_HEIGHT = 900;

export function referenceYForGeneration(
  generation: number,
  canvasHeight: number,
  maxGeneration = 5,
): number {
  return generationYForGeneration(generation, canvasHeight, maxGeneration);
}

/** Horizontal anchor for gen-2 branch (0..1 of canvas width). */
export function referenceAnchorX(branchIndex: number, branchCount: number, canvasWidth: number): number {
  const anchors = referenceComposition.gen1Anchors;

  if (branchCount === anchors.length) {
    return canvasWidth * anchors[branchIndex];
  }

  if (branchCount <= 1) {
    return canvasWidth * 0.5;
  }

  const start = anchors[0];
  const end = anchors[anchors.length - 1];
  const step = (end - start) / (branchCount - 1);
  return canvasWidth * (start + step * branchIndex);
}

export function referenceCanvasSize(): { width: number; height: number } {
  return {
    width: REFERENCE_CANVAS_WIDTH,
    height: REFERENCE_CANVAS_HEIGHT,
  };
}
