import {
  cardWidthForMember,
  getBranchGap,
  isFounderMember,
} from './constants';
import {
  applyCanopyYByTreeDepth,
  maxGenerationFromTree,
} from './generationYLayout';
import type { LayoutTreeNode, PositionedMember } from './types';
import type { StageBounds } from './stageBounds';
import { memberRenderBox } from './memberBoundingBox';

export interface BranchLayoutResult {
  canvasWidth: number;
  canvasHeight: number;
  maxGeneration: number;
}

function rowGapForChildren(
  children: LayoutTreeNode[],
  zoneLeft: number,
  zoneRight: number,
  minGap: number,
): number {
  if (children.length <= 1) return minGap;

  const totalCardWidth = children.reduce(
    (sum, child) => sum + cardWidthForMember(child),
    0,
  );
  const available = zoneRight - zoneLeft - totalCardWidth;
  return Math.max(minGap, available / (children.length - 1));
}

function layoutChildrenRow(
  parent: LayoutTreeNode,
  zoneLeft: number,
  zoneRight: number,
  minGap: number,
): void {
  const children = [...parent.children].sort((a, b) => a.id - b.id);
  if (children.length === 0) return;

  const gap = rowGapForChildren(children, zoneLeft, zoneRight, minGap);
  let rowWidth = children.reduce((sum, child, index) => {
    const spacing = index > 0 ? gap : 0;
    return sum + cardWidthForMember(child) + spacing;
  }, 0);

  const zoneWidth = zoneRight - zoneLeft;
  let startX: number;

  if (rowWidth > zoneWidth) {
    const tightGap = children.length > 1
      ? Math.max(minGap, (zoneWidth - children.reduce((s, c) => s + cardWidthForMember(c), 0)) / (children.length - 1))
      : minGap;
    rowWidth = children.reduce((sum, child, index) => {
      const spacing = index > 0 ? tightGap : 0;
      return sum + cardWidthForMember(child) + spacing;
    }, 0);
    startX = zoneLeft + (zoneWidth - rowWidth) / 2;
    children.forEach((child, index) => {
      const offset = children.slice(0, index).reduce(
        (sum, prev) => sum + cardWidthForMember(prev) + tightGap,
        0,
      );
      child.x = startX + offset;
    });
    return;
  }

  const parentCenter = parent.x + cardWidthForMember(parent) / 2;
  startX = parentCenter - rowWidth / 2;
  startX = Math.max(zoneLeft, Math.min(startX, zoneRight - rowWidth));

  children.forEach((child, index) => {
    const offset = children.slice(0, index).reduce(
      (sum, prev) => sum + cardWidthForMember(prev) + gap,
      0,
    );
    child.x = startX + offset;
  });
}

function layoutBranchSubtree(
  node: LayoutTreeNode,
  zoneLeft: number,
  zoneRight: number,
  minGap: number,
): void {
  layoutChildrenRow(node, zoneLeft, zoneRight, minGap);
  node.children.forEach((child) => {
    layoutBranchSubtree(child, zoneLeft, zoneRight, minGap);
  });
}

/**
 * Lay out founder tree inside the full viewport stage (not a narrow virtual canvas).
 */
export function layoutFounderTreeInStage(
  root: LayoutTreeNode,
  stage: StageBounds,
): BranchLayoutResult {
  const minGap = stage.minGap;
  const gen2Branches = [...root.children].sort((a, b) => a.id - b.id);
  const maxGeneration = maxGenerationFromTree([root]);
  const branchCount = Math.max(1, gen2Branches.length);
  const usableWidth = stage.usableRight - stage.usableLeft;
  const branchZoneWidth = usableWidth / branchCount;
  const branchGap = Math.max(minGap, getBranchGap() * 0.35);

  applyCanopyYByTreeDepth([root], stage);

  root.x = (stage.usableLeft + stage.usableRight) / 2 - cardWidthForMember(root) / 2;

  gen2Branches.forEach((branch, index) => {
    const zoneLeft = stage.usableLeft + index * branchZoneWidth + minGap;
    const zoneRight = stage.usableLeft + (index + 1) * branchZoneWidth - minGap;
    const zoneCenter = (zoneLeft + zoneRight) / 2;

    branch.x = zoneCenter - cardWidthForMember(branch) / 2;

    layoutChildrenRow(branch, zoneLeft, zoneRight, minGap);
    branch.children.forEach((child) => {
      layoutBranchSubtree(child, zoneLeft, zoneRight, minGap);
    });
  });

  void branchGap;

  return {
    canvasWidth: stage.width,
    canvasHeight: stage.height,
    maxGeneration,
  };
}

/** @deprecated Use layoutFounderTreeInStage */
export function layoutFounderTreeWithBranchZones(
  root: LayoutTreeNode,
  stage?: StageBounds,
): BranchLayoutResult {
  const fallback: StageBounds = stage ?? {
    width: 1600,
    height: 900,
    paddingX: 48,
    paddingY: 40,
    minGap: 10,
    usableLeft: 48,
    usableRight: 1552,
    usableTop: 40,
    usableBottom: 860,
  };
  return layoutFounderTreeInStage(root, fallback);
}

export function measureMemberBounds(members: PositionedMember[]) {
  if (members.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  members.forEach((member) => {
    const box = memberRenderBox(member);
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  });

  return { minX, minY, maxX, maxY };
}

export function shiftMembers(
  members: PositionedMember[],
  dx: number,
  dy: number,
): PositionedMember[] {
  if (dx === 0 && dy === 0) return members;
  return members.map((member) => ({ ...member, x: member.x + dx, y: member.y + dy }));
}

export function isSingleFounderTree(roots: LayoutTreeNode[]): boolean {
  if (roots.length !== 1) return false;
  return roots[0].id >= 0 && isFounderMember(roots[0]);
}

export function resolveGenerationOverlaps(members: PositionedMember[]): PositionedMember[] {
  return members.map((member) => ({ ...member }));
}
