import { getLayoutScale } from './layoutScaleContext';
import type { LayoutTreeNode, TreeLayoutResult } from './types';
import { normalizeToVirtualCanvas } from './canvasNormalize';
import { generateBranchPathsFromLayout } from './generateBranchPath';
import { buildGenerationLayoutDiagnostics } from './generationYLayout';
import { validateSubtreeLayout } from './layoutValidation';
import { syncMembersToTree } from './normalizeStageLayout';
import { layoutTreeBySubtrees } from './subtreeLayout';
import { createStageBounds } from './stageBounds';

function finalizeLayout(
  roots: LayoutTreeNode[],
): TreeLayoutResult {
  const scale = getLayoutScale();
  const laidOut = layoutTreeBySubtrees(roots);

  syncMembersToTree(roots, laidOut);
  const rawConnectors = generateBranchPathsFromLayout(roots, laidOut);
  const virtual = normalizeToVirtualCanvas(laidOut, rawConnectors);
  const resolved = virtual.members;

  syncMembersToTree(roots, resolved);
  const validation = validateSubtreeLayout(
    roots,
    resolved,
    virtual.connectors,
    virtual.canvasWidth,
    virtual.canvasHeight,
  );

  if (import.meta.env?.DEV && resolved.length >= 10) {
    console.info('[TreeLayout] compact subtree + canvas', {
      virtualCanvas: {
        width: virtual.canvasWidth,
        height: virtual.canvasHeight,
      },
      contentBounds: virtual.contentBounds,
      validation,
      ...buildGenerationLayoutDiagnostics(resolved, virtual.canvasHeight, scale.generationGap),
    });

    const incomplete = (
      validation.overlappingCards > 0
      || validation.clippedCards > 0
      || validation.cardsOutsideCanvas > 0
      || validation.negativeNodeCoordinates > 0
      || validation.excessiveBranchGaps > 0
      || validation.splitSiblingGroups > 0
      || validation.connectorIntersections > 0
      || validation.invalidParentLinks > 0
    );

    if (incomplete) {
      console.warn('[TreeLayout] layout incomplete', validation);
    }
  }

  return {
    members: resolved,
    labels: [],
    connectors: virtual.connectors,
    canvasWidth: virtual.canvasWidth,
    canvasHeight: virtual.canvasHeight,
    contentBounds: virtual.contentBounds,
    scale,
    validation,
  };
}

/** Subtree layout on a virtual canvas — compact branches, full bounds fit. */
export function calculateTreeLayout(
  roots: LayoutTreeNode[],
  stageInput?: { width: number; height: number },
): TreeLayoutResult {
  const stage = createStageBounds(
    stageInput?.width ?? 1600,
    stageInput?.height ?? 900,
  );

  if (roots.length === 0) {
    return {
      members: [],
      labels: [],
      connectors: [],
      canvasWidth: stage.width,
      canvasHeight: stage.height,
      contentBounds: {
        minX: 0,
        minY: 0,
        maxX: stage.width,
        maxY: stage.height,
      },
      scale: getLayoutScale(),
      validation: {
        overlappingCards: 0,
        clippedCards: 0,
        hiddenNames: 0,
        duplicatePositions: 0,
        splitSiblingGroups: 0,
        connectorIntersections: 0,
        invalidParentLinks: 0,
        cardOverlaps: 0,
        cardsOutsideCanvas: 0,
        negativeNodeCoordinates: 0,
        excessiveBranchGaps: 0,
      },
    };
  }

  return finalizeLayout(roots);
}
