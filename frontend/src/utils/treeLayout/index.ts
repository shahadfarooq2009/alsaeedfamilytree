import { buildFamilyHierarchy } from './buildFamilyHierarchy';
import { calculateTreeLayout } from './calculateTreeLayout';
import {
  maxChildrenInAnyNode,
  maxFamilyGroupsPerBranchZone,
  maxNodesPerBranchZone,
} from './branchZoneLayout';
import { maxGenerationFromMembers } from './generationYLayout';
import { setLayoutScale } from './layoutScaleContext';
import { DEFAULT_STAGE, type LayoutStage } from './stageBounds';
import { computeTreeLayoutScale } from './treeLayoutScale';
import type { FamilyMemberInput, TreeLayoutResult } from './types';

/** Full pipeline: viewport-sized layout → readable cards → fit-to-screen at 1:1 when possible. */
export function computeDynamicTreeLayout(
  members: FamilyMemberInput[],
  stage: LayoutStage = DEFAULT_STAGE,
): TreeLayoutResult {
  const maxGeneration = maxGenerationFromMembers(members);

  if (members.length === 0) {
    const scale = computeTreeLayoutScale(1, 1, stage);
    setLayoutScale(scale);
    return calculateTreeLayout([], stage);
  }

  let bestResult: TreeLayoutResult | null = null;
  let compactFactor = 1;
  let maxCluster = 1;
  let maxFamilyGroups = 1;
  let branchCount = 1;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roots = buildFamilyHierarchy(members);
    maxCluster = Math.max(maxChildrenInAnyNode(roots), maxNodesPerBranchZone(roots));
    maxFamilyGroups = maxFamilyGroupsPerBranchZone(roots);
    branchCount = Math.max(1, roots[0]?.children.length ?? 1);

    const scale = computeTreeLayoutScale(
      members.length,
      maxGeneration,
      stage,
      maxCluster,
      branchCount,
      compactFactor,
      maxFamilyGroups,
    );
    setLayoutScale(scale);
    const result = calculateTreeLayout(roots, stage);
    bestResult = result;

    if (result.validation?.valid) {
      break;
    }

    compactFactor *= 0.92;
  }

  return bestResult!;
}

export * from './types';
export * from './constants';
export * from './buildFamilyHierarchy';
export { flattenHierarchyNodes } from './buildFamilyHierarchy';
export * from './resolveLayoutParent';
export { DEFAULT_STAGE, stageFromViewport } from './stageBounds';
export type { LayoutStage } from './stageBounds';
