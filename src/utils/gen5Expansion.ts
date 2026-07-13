import { resolvePrimaryTreeParentId } from './treeLayout/primaryTreeParent';
import {
  getDisplayGeneration,
  getGenerationBaseline,
} from './progressiveTreeDisclosure';
import type { FamilyMemberInput } from './treeLayout/types';

export const DEFAULT_MAX_BASE_GENERATIONS = 4;

export const GEN5_ZOOM_THRESHOLD = 0.68;
export const GEN5_ICON_SIZE = 22;
export const GEN5_ICON_GAP = 10;
export const GEN5_NODE_WIDTH = 58;
export const GEN5_NODE_HEIGHT = 34;
export const GEN5_FONT_SIZE = 7.5;
export const MAX_GEN5_PER_ROW = 4;
export const GEN5_GAP_X = 8;
export const GEN5_ROW_GAP = 32;

export const ADAPTIVE_MIN_ZOOM = 0.55;
export const ADAPTIVE_MAX_ZOOM = 0.9;
export const GEN5_FIT_PADDING = 0.08;
export const GEN5_FIT_DURATION_MS = 500;

export function filterBaseGenerationMembers(
  allMembers: FamilyMemberInput[],
  maxGenerations = DEFAULT_MAX_BASE_GENERATIONS,
): FamilyMemberInput[] {
  if (allMembers.length === 0) return [];
  const baseline = getGenerationBaseline(allMembers);
  return allMembers.filter(
    (member) => getDisplayGeneration(member, baseline) <= maxGenerations,
  );
}

export function getDirectGen5Children(
  parentId: number,
  allMembers: FamilyMemberInput[],
): FamilyMemberInput[] {
  const baseline = getGenerationBaseline(allMembers);
  const parent = allMembers.find((member) => member.id === parentId);
  if (!parent) return [];

  const parentDisplayGen = getDisplayGeneration(parent, baseline);
  if (parentDisplayGen !== DEFAULT_MAX_BASE_GENERATIONS) return [];

  return allMembers.filter((member) => {
    const parentLink = resolvePrimaryTreeParentId(member);
    if (parentLink !== parentId) return false;
    return getDisplayGeneration(member, baseline) === DEFAULT_MAX_BASE_GENERATIONS + 1;
  });
}

export function getGen4ParentsWithGen5Children(
  allMembers: FamilyMemberInput[],
): Map<number, FamilyMemberInput[]> {
  const baseline = getGenerationBaseline(allMembers);
  const map = new Map<number, FamilyMemberInput[]>();

  allMembers.forEach((member) => {
    if (getDisplayGeneration(member, baseline) !== DEFAULT_MAX_BASE_GENERATIONS) return;
    const children = getDirectGen5Children(member.id, allMembers);
    if (children.length > 0) {
      map.set(member.id, children);
    }
  });

  return map;
}

export function shouldShowGen5Cards(
  parentId: number,
  expandedGen5ParentIds: ReadonlySet<number>,
  currentZoom: number,
): boolean {
  return currentZoom >= GEN5_ZOOM_THRESHOLD && expandedGen5ParentIds.has(parentId);
}

export function shouldShowGen5Icon(
  parentId: number,
  gen5ChildCount: number,
  expandedGen5ParentIds: ReadonlySet<number>,
  currentZoom: number,
): boolean {
  if (gen5ChildCount <= 0) return false;
  return !shouldShowGen5Cards(parentId, expandedGen5ParentIds, currentZoom);
}

export function computeAdaptiveZoom(visibleNodeCount: number): number {
  if (visibleNodeCount <= 120) return 0.82;
  if (visibleNodeCount <= 180) return 0.72;
  if (visibleNodeCount <= 250) return 0.62;
  return ADAPTIVE_MIN_ZOOM;
}

export function chunkMembers<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function countVisibleFlowNodes(
  baseMemberCount: number,
  gen4ParentsWithGen5: Map<number, FamilyMemberInput[]>,
  expandedGen5ParentIds: ReadonlySet<number>,
  currentZoom: number,
): number {
  let count = baseMemberCount;

  gen4ParentsWithGen5.forEach((children, parentId) => {
    if (shouldShowGen5Icon(parentId, children.length, expandedGen5ParentIds, currentZoom)) {
      count += 1;
      return;
    }
    if (shouldShowGen5Cards(parentId, expandedGen5ParentIds, currentZoom)) {
      count += children.length;
    }
  });

  return count;
}

export function gen5IconNodeId(parentId: number): string {
  return `gen5-icon-${parentId}`;
}
