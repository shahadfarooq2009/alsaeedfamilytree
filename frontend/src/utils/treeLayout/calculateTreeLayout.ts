import { isFounderMember } from './constants';
import { getLayoutScale } from './layoutScaleContext';
import { flattenLayoutNodes } from './buildFamilyHierarchy';
import type { LayoutTreeNode, PositionedMember, TreeLayoutResult } from './types';
import { generateBranchPathsFromLayout } from './generateBranchPath';
import { resolveLayoutCollisions } from './detectCollisions';
import { validateLayout, type LayoutValidationReport } from './layoutValidation';
import { DEFAULT_STAGE, type LayoutStage } from './stageBounds';
import {
  layoutFounderTreeWithBranchZones,
  maxNodesPerBranchZone,
  measureMemberBounds,
} from './branchZoneLayout';

function syncPositionsToTree(roots: LayoutTreeNode[], members: PositionedMember[]): void {
  const byId = new Map(members.map((member) => [member.id, member]));

  const walk = (node: LayoutTreeNode): void => {
    const positioned = byId.get(node.id);
    if (positioned) {
      node.x = positioned.x;
      node.y = positioned.y;
    }
    node.children.forEach(walk);
  };

  roots.forEach(walk);
}

function nodesToMembers(roots: LayoutTreeNode[]): PositionedMember[] {
  return flattenLayoutNodes(roots).map((node) => ({
    id: node.id,
    fullName: node.fullName,
    fatherId: node.fatherId,
    motherId: node.motherId,
    gender: node.gender,
    generation: node.generation,
    initial: node.initial,
    photoUrl: node.photoUrl,
    relationLabel: node.relationLabel,
    x: node.x,
    y: node.y,
  }));
}

function runCollisionPasses(
  members: PositionedMember[],
  roots: LayoutTreeNode[],
  passes = 3,
): PositionedMember[] {
  let resolved = members;
  for (let i = 0; i < passes; i += 1) {
    resolved = resolveLayoutCollisions(resolved, roots);
  }
  return resolved;
}

function finalizeLayout(
  roots: LayoutTreeNode[],
  stage: LayoutStage,
): TreeLayoutResult & { validation: LayoutValidationReport } {
  const scale = getLayoutScale();
  const maxCluster = maxNodesPerBranchZone(roots);

  const { canvasWidth, canvasHeight } = layoutFounderTreeWithBranchZones(
    roots[0],
    stage,
    maxCluster,
  );

  let resolved = nodesToMembers(roots);
  syncPositionsToTree(roots, resolved);

  let validation = validateLayout(resolved, stage);

  if (validation.overlappingCards > 0) {
    resolved = runCollisionPasses(resolved, roots, 24);
    syncPositionsToTree(roots, resolved);
    validation = validateLayout(resolved, stage);

    let safety = 0;
    while (validation.overlappingCards > 0 && safety < 12) {
      resolved = resolveLayoutCollisions(resolved, roots);
      syncPositionsToTree(roots, resolved);
      validation = validateLayout(resolved, stage);
      safety += 1;
    }
  }

  const bounds = measureMemberBounds(resolved);
  const connectors = generateBranchPathsFromLayout(roots, resolved);
  const labels = [];

  if (import.meta.env?.DEV && resolved.length >= 10) {
    console.info('[TreeLayout] viewport-fill validation', {
      overlappingCards: validation.overlappingCards,
      clippedCards: validation.clippedCards,
      contentBounds: bounds,
      canvas: { width: canvasWidth, height: canvasHeight },
      card: { width: scale.cardWidth, height: scale.cardHeight },
      founderY: resolved.find((m) => isFounderMember(m))?.y,
    });
  }

  if (!validation.valid && import.meta.env?.DEV) {
    console.warn('[TreeLayout] unresolved layout issues', validation);
  }

  return {
    members: resolved,
    labels,
    connectors,
    canvasWidth,
    canvasHeight,
    contentBounds: bounds,
    scale,
    validation,
    layoutFillsStage: validation.valid,
  };
}

export function calculateTreeLayout(
  roots: LayoutTreeNode[],
  stage: LayoutStage = DEFAULT_STAGE,
): TreeLayoutResult & { validation?: LayoutValidationReport; layoutFillsStage?: boolean } {
  if (roots.length === 0) {
    return {
      members: [],
      labels: [],
      connectors: [],
      canvasWidth: stage.width,
      canvasHeight: stage.height,
      contentBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      scale: getLayoutScale(),
      validation: { overlappingCards: 0, clippedCards: 0, hiddenNames: 0, overlapPairs: [], valid: true },
      layoutFillsStage: true,
    };
  }

  return finalizeLayout(roots, stage);
}
