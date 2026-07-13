import { buildFamilyHierarchy } from './buildFamilyHierarchy';
import { calculateTreeLayout } from './calculateTreeLayout';
import { maxGenerationFromMembers } from './generationYLayout';
import {
  countTreeLeaves,
  maxChildrenPerParent,
  maxMembersPerGeneration,
} from './layoutMetrics';
import { setLayoutScale } from './layoutScaleContext';
import { createStageBounds, DEFAULT_STAGE } from './stageBounds';
import { computeTreeLayoutScale } from './treeLayoutScale';
import type { FamilyMemberInput, TreeLayoutResult } from './types';

export interface StageSize {
  width: number;
  height: number;
}

/** Full pipeline: scale → hierarchy → subtree layout → virtual canvas. */
export function computeDynamicTreeLayout(
  members: FamilyMemberInput[],
  stageSize: StageSize = DEFAULT_STAGE,
): TreeLayoutResult {
  const maxGeneration = maxGenerationFromMembers(members);
  const stage = createStageBounds(stageSize.width, stageSize.height);

  if (members.length === 0) {
    return calculateTreeLayout([], stageSize);
  }

  const roots = buildFamilyHierarchy(members);
  const scale = computeTreeLayoutScale({
    memberCount: members.length,
    maxGeneration,
    stageWidth: stage.width,
    stageHeight: stage.height,
    maxChildrenPerRow: maxChildrenPerParent(members),
    maxMembersAtDepth: maxMembersPerGeneration(members),
    leafCount: countTreeLeaves(roots),
    branchCount: Math.max(1, roots[0]?.children.filter((child) => child.id >= 0).length),
  });
  setLayoutScale(scale);

  return calculateTreeLayout(roots, stageSize);
}

export * from './types';
export * from './constants';
export * from './buildFamilyHierarchy';
export { flattenHierarchyNodes } from './buildFamilyHierarchy';
export * from './resolveLayoutParent';
export {
  MIN_CARD_WIDTH,
  MIN_CARD_HEIGHT,
  MIN_FONT_SIZE,
  MIN_BADGE_SIZE,
  SAFE_PADDING_X,
  SAFE_PADDING_Y,
  SHADOW_PADDING,
  FIT_WIDTH_RATIO,
  FIT_HEIGHT_RATIO,
  clampCardWidth,
  clampCardHeight,
  clampBadgeSize,
  clampFontSize,
} from './layoutConstants';
