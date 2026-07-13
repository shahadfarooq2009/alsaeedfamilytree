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

/** Full pipeline: balanced main-branch sectors → fit-to-viewport at 1:1 when possible. */
export function computeDynamicTreeLayout(
  members: FamilyMemberInput[],
  stage: LayoutStage = DEFAULT_STAGE,
): TreeLayoutResult {
  const maxGeneration = maxGenerationFromMembers(members);

  if (members.length === 0) {
    const scale = computeTreeLayoutScale(1, 1, stage);
    setLayoutScale(scale);
    return calculateTreeLayout([], stage, []);
  }

  const roots = buildFamilyHierarchy(members);
  const maxCluster = Math.max(maxChildrenInAnyNode(roots), maxNodesPerBranchZone(roots));
  const maxFamilyGroups = maxFamilyGroupsPerBranchZone(roots);
  const branchCount = Math.max(1, roots[0]?.children.length ?? 1);

  const scale = computeTreeLayoutScale(
    members.length,
    maxGeneration,
    stage,
    maxCluster,
    branchCount,
    1,
    maxFamilyGroups,
  );
  setLayoutScale(scale);

  return calculateTreeLayout(roots, stage, members);
}

export * from './types';
export * from './constants';
export * from './buildFamilyHierarchy';
export * from './siblingOrder';
export { flattenHierarchyNodes } from './buildFamilyHierarchy';
export * from './resolveLayoutParent';
export * from './primaryTreeParent';
export { DEFAULT_STAGE, stageFromViewport, mainBranchUsableRect } from './stageBounds';
export type { LayoutStage } from './stageBounds';
