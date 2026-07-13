import {
  cardFootprintForMember,
  cardWidthForMember,
  getBadgeOverhang,
  getBranchGap,
  getFamilyGroupGap,
  getFounderChildGap,
  getSiblingGap,
  isFounderMember,
} from './constants';
import { MIN_CARD_GAP, measureMembersBounds } from './cardBounds';
import {
  applyCanopyYByTreeDepth,
  maxGenerationFromTree,
} from './generationYLayout';
import { usableStageRect, type LayoutStage } from './stageBounds';
import type { LayoutTreeNode, PositionedMember } from './types';

export interface BranchLayoutResult {
  canvasWidth: number;
  canvasHeight: number;
  maxGeneration: number;
}

interface BranchZone {
  left: number;
  right: number;
  branch: LayoutTreeNode;
}

export function maxChildrenInAnyNode(roots: LayoutTreeNode[]): number {
  let max = 0;
  const walk = (node: LayoutTreeNode): void => {
    max = Math.max(max, node.children.length);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return max;
}

export function maxNodesPerBranchZone(roots: LayoutTreeNode[]): number {
  let max = 1;

  roots.forEach((root) => {
    root.children.forEach((branch) => {
      const counts = new Map<number, number>();
      const walk = (node: LayoutTreeNode, depth: number): void => {
        if (node.id >= 0) counts.set(depth, (counts.get(depth) ?? 0) + 1);
        node.children.forEach((child) => walk(child, depth + 1));
      };
      walk(branch, 2);
      max = Math.max(max, ...counts.values());
    });
  });

  return max;
}

export function maxFamilyGroupsPerBranchZone(roots: LayoutTreeNode[]): number {
  let max = 1;

  roots.forEach((root) => {
    root.children.forEach((branch) => {
      const fathersByDepth = new Map<number, Set<number>>();
      const walk = (node: LayoutTreeNode, depth: number): void => {
        if (node.id >= 0 && node.fatherId != null) {
          const set = fathersByDepth.get(depth) ?? new Set<number>();
          set.add(node.fatherId);
          fathersByDepth.set(depth, set);
        }
        node.children.forEach((child) => walk(child, depth + 1));
      };
      walk(branch, 2);
      fathersByDepth.forEach((set) => {
        max = Math.max(max, set.size);
      });
    });
  });

  return max;
}

function groupByFather(nodes: LayoutTreeNode[]): Array<{ fatherId: number; children: LayoutTreeNode[] }> {
  const map = new Map<number, LayoutTreeNode[]>();

  nodes.forEach((node) => {
    const fatherId = node.fatherId ?? -1;
    const list = map.get(fatherId) ?? [];
    list.push(node);
    map.set(fatherId, list);
  });

  return Array.from(map.entries())
    .map(([fatherId, children]) => ({
      fatherId,
      children: children.sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => a.fatherId - b.fatherId);
}

function fatherCenterX(fatherId: number, nodeById: Map<number, LayoutTreeNode>, fallback: number): number {
  const father = nodeById.get(fatherId);
  if (!father) return fallback;
  return father.x + cardWidthForMember(father) / 2;
}

function branchCenterX(branch: LayoutTreeNode): number {
  return branch.x + cardWidthForMember(branch) / 2;
}

function groupWidth(children: LayoutTreeNode[], siblingGap: number): number {
  if (children.length === 0) return 0;
  const widths = children.map((child) => cardWidthForMember(child));
  return widths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, children.length - 1) * siblingGap;
}

function generationBandHeight(canvasHeight: number, maxDepth: number): number {
  const usableTop = canvasHeight * 0.1;
  const usableBottom = canvasHeight * 0.9;
  return (usableBottom - usableTop) / Math.max(1, maxDepth - 1);
}

function depthSubRowStep(
  sample: LayoutTreeNode,
  rowCount: number,
  canvasHeight: number,
  maxDepth: number,
): number {
  const footprint = cardFootprintForMember(sample);
  const ideal = footprint + Math.max(MIN_CARD_GAP, getSiblingGap());
  if (rowCount <= 1) return ideal;

  const band = generationBandHeight(canvasHeight, maxDepth);
  const maxStep = Math.floor((band - footprint - MIN_CARD_GAP) / (rowCount - 1));
  return Math.max(MIN_CARD_GAP, Math.min(ideal, maxStep));
}

function placeChildrenRow(
  children: LayoutTreeNode[],
  left: number,
  siblingGap: number,
): void {
  let x = left;
  children.forEach((child) => {
    child.x = x;
    x += cardWidthForMember(child) + siblingGap;
  });
}

function placeChildrenTwoRows(
  children: LayoutTreeNode[],
  left: number,
  slotWidth: number,
  siblingGap: number,
  subRowOffsets: Map<number, number>,
  rowStep: number,
): void {
  const split = Math.ceil(children.length / 2);
  const topRow = children.slice(0, split);
  const bottomRow = children.slice(split);
  const topWidth = groupWidth(topRow, siblingGap);
  const bottomWidth = groupWidth(bottomRow, siblingGap);
  const maxWidth = Math.max(topWidth, bottomWidth);
  const rowLeft = left + Math.max(0, (slotWidth - maxWidth) / 2);

  placeChildrenRow(topRow, rowLeft, siblingGap);
  placeChildrenRow(bottomRow, rowLeft, siblingGap);

  bottomRow.forEach((child) => {
    subRowOffsets.set(child.id, (subRowOffsets.get(child.id) ?? 0) - rowStep);
  });
}

function collectDescendants(branch: LayoutTreeNode): LayoutTreeNode[] {
  const out: LayoutTreeNode[] = [];
  const walk = (node: LayoutTreeNode): void => {
    node.children.forEach((child) => {
      if (child.id >= 0) out.push(child);
      walk(child);
    });
  };
  walk(branch);
  return out;
}

/** One clear generation row: founder's direct children spread across the full canopy. */
function layoutFounderChildrenRow(
  children: LayoutTreeNode[],
  usable: ReturnType<typeof usableStageRect>,
): void {
  const n = children.length;
  if (n === 0) return;

  const widths = children.map((child) => cardWidthForMember(child));
  const minBranchGap = Math.max(MIN_CARD_GAP, getBranchGap(), Math.floor(getFounderChildGap() / 5));
  const totalCardWidth = widths.reduce((sum, width) => sum + width, 0);

  if (n === 1) {
    children[0].x = (usable.left + usable.right) / 2 - widths[0] / 2;
    return;
  }

  const minNeeded = totalCardWidth + (n - 1) * minBranchGap;

  if (minNeeded <= usable.width) {
    const gap = (usable.width - totalCardWidth) / (n - 1);
    let cursor = usable.left;
    children.forEach((child, index) => {
      child.x = cursor;
      cursor += widths[index] + gap;
    });
    return;
  }

  children.forEach((child, index) => {
    const centerX = usable.left + ((index + 0.5) / n) * usable.width;
    child.x = centerX - widths[index] / 2;
  });
}

/** Branch columns from gen-2 centers — fills the full canopy width. */
function branchZonesFromFounderChildren(
  branches: LayoutTreeNode[],
  usable: ReturnType<typeof usableStageRect>,
): BranchZone[] {
  if (branches.length === 0) return [];

  const centers = branches.map(branchCenterX);

  return branches.map((branch, index) => {
    const left = index === 0
      ? usable.left
      : (centers[index - 1] + centers[index]) / 2;
    const right = index === branches.length - 1
      ? usable.right
      : (centers[index] + centers[index + 1]) / 2;
    return { left, right, branch };
  });
}

function clampDescendantsToZone(branch: LayoutTreeNode, zoneLeft: number, zoneRight: number): void {
  const descendants = collectDescendants(branch);
  if (descendants.length === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  descendants.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + cardWidthForMember(node));
  });

  let dx = 0;
  if (maxX > zoneRight) dx -= maxX - zoneRight;
  if (minX + dx < zoneLeft) dx += zoneLeft - (minX + dx);

  if (dx !== 0) {
    descendants.forEach((node) => { node.x += dx; });
  }
}

interface FamilyGroupPlan {
  fatherId: number;
  children: LayoutTreeNode[];
  width: number;
  idealLeft: number;
  left: number;
  twoRowChildren: boolean;
}

/** Pack sibling groups under their father inside a branch column. */
function packFamilyGroupsInZone(
  nodes: LayoutTreeNode[],
  zoneLeft: number,
  zoneRight: number,
  nodeById: Map<number, LayoutTreeNode>,
  subRowOffsets: Map<number, number>,
  canvasHeight: number,
  maxDepth: number,
): void {
  if (nodes.length === 0) return;

  const siblingGap = Math.max(MIN_CARD_GAP, getSiblingGap());
  const familyGap = Math.max(MIN_CARD_GAP, getFamilyGroupGap());
  const available = zoneRight - zoneLeft;
  const groups = groupByFather(nodes);

  const plans: FamilyGroupPlan[] = groups.map((group) => {
    const width = groupWidth(group.children, siblingGap);
    const fatherX = fatherCenterX(group.fatherId, nodeById, zoneLeft + width / 2);
    return {
      fatherId: group.fatherId,
      children: group.children,
      width,
      idealLeft: fatherX - width / 2,
      left: 0,
      twoRowChildren: width > available && group.children.length > 2,
    };
  });

  plans.forEach((plan) => {
    if (plan.twoRowChildren) {
      const split = Math.ceil(plan.children.length / 2);
      const topRow = plan.children.slice(0, split);
      const bottomRow = plan.children.slice(split);
      plan.width = Math.max(
        groupWidth(topRow, siblingGap),
        groupWidth(bottomRow, siblingGap),
      );
    }
  });

  plans.sort((a, b) => a.idealLeft - b.idealLeft);

  const rows: FamilyGroupPlan[][] = [];
  let currentRow: FamilyGroupPlan[] = [];
  let rowWidth = 0;

  plans.forEach((plan) => {
    const extraGap = currentRow.length > 0 ? familyGap : 0;
    const nextWidth = rowWidth + extraGap + plan.width;

    if (nextWidth > available && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [plan];
      rowWidth = plan.width;
      return;
    }

    currentRow.push(plan);
    rowWidth = nextWidth;
  });

  if (currentRow.length > 0) rows.push(currentRow);

  const rowStep = depthSubRowStep(nodes[0], rows.length, canvasHeight, maxDepth);

  rows.forEach((row, rowIndex) => {
    row.sort((a, b) => a.idealLeft - b.idealLeft);

    let prevRight = -Infinity;
    row.forEach((plan, index) => {
      let left = plan.idealLeft;
      if (index > 0) left = Math.max(left, prevRight + familyGap);
      left = Math.max(zoneLeft, Math.min(left, zoneRight - plan.width));
      plan.left = left;
      prevRight = left + plan.width;
    });

    const rowSpan = prevRight - row[0].left;
    if (rowSpan > available) {
      let cursor = zoneLeft;
      row.forEach((plan, index) => {
        if (index > 0) cursor += familyGap;
        plan.left = cursor;
        cursor += plan.width;
      });
    } else if (row[row.length - 1].left + row[row.length - 1].width > zoneRight) {
      const overflow = row[row.length - 1].left + row[row.length - 1].width - zoneRight;
      row.forEach((plan) => { plan.left -= overflow; });
    }

    if (row[0].left < zoneLeft) {
      const shift = zoneLeft - row[0].left;
      row.forEach((plan) => { plan.left += shift; });
    }

    const rowOffset = rowIndex * rowStep;
    row.forEach((plan) => {
      if (plan.twoRowChildren) {
        placeChildrenTwoRows(
          plan.children,
          plan.left,
          plan.width,
          siblingGap,
          subRowOffsets,
          rowStep,
        );
      } else {
        placeChildrenRow(plan.children, plan.left, siblingGap);
      }

      if (rowOffset > 0) {
        plan.children.forEach((child) => {
          subRowOffsets.set(child.id, (subRowOffsets.get(child.id) ?? 0) - rowOffset);
        });
      }
    });
  });
}

function layoutBranchDescendants(
  branch: LayoutTreeNode,
  zoneLeft: number,
  zoneRight: number,
  nodeById: Map<number, LayoutTreeNode>,
  subRowOffsets: Map<number, number>,
  canvasHeight: number,
  maxDepth: number,
): void {
  const byDepth = new Map<number, LayoutTreeNode[]>();

  const walk = (node: LayoutTreeNode, depth: number): void => {
    if (node.id >= 0) {
      const list = byDepth.get(depth) ?? [];
      list.push(node);
      byDepth.set(depth, list);
    }
    node.children.forEach((child) => walk(child, depth + 1));
  };

  branch.children.forEach((child) => walk(child, 3));

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  depths.forEach((depth) => {
    const nodes = byDepth.get(depth) ?? [];
    packFamilyGroupsInZone(
      nodes,
      zoneLeft,
      zoneRight,
      nodeById,
      subRowOffsets,
      canvasHeight,
      maxDepth,
    );
  });

  clampDescendantsToZone(branch, zoneLeft, zoneRight);
}

function applySubRowOffsets(
  root: LayoutTreeNode,
  subRowOffsets: Map<number, number>,
  canvasHeight: number,
): void {
  const minCardTop = canvasHeight * 0.1 + getBadgeOverhang();

  const walk = (node: LayoutTreeNode): void => {
    let offset = subRowOffsets.get(node.id) ?? 0;
    if (offset < 0) {
      const minAllowed = minCardTop - node.y;
      offset = Math.max(offset, minAllowed);
    }
    if (offset) node.y += offset;
    node.children.forEach(walk);
  };
  walk(root);
}

function indexNodes(root: LayoutTreeNode): Map<number, LayoutTreeNode> {
  const map = new Map<number, LayoutTreeNode>();
  const walk = (node: LayoutTreeNode): void => {
    if (node.id >= 0) map.set(node.id, node);
    node.children.forEach(walk);
  };
  walk(root);
  return map;
}

export function layoutFounderTreeWithBranchZones(
  root: LayoutTreeNode,
  stage: LayoutStage,
  _maxClusterSize: number,
): BranchLayoutResult {
  const usable = usableStageRect(stage);
  const gen2Branches = [...root.children].sort((a, b) => a.id - b.id);
  const maxGeneration = maxGenerationFromTree([root]);
  const canvasWidth = stage.width;
  const canvasHeight = stage.height;
  const subRowOffsets = new Map<number, number>();
  const nodeById = indexNodes(root);
  const maxDepth = maxGeneration;

  root.x = canvasWidth / 2 - cardWidthForMember(root) / 2;

  if (gen2Branches.length > 0) {
    layoutFounderChildrenRow(gen2Branches, usable);

    const zones = branchZonesFromFounderChildren(gen2Branches, usable);
    zones.forEach(({ left, right, branch }) => {
      layoutBranchDescendants(
        branch,
        left,
        right,
        nodeById,
        subRowOffsets,
        canvasHeight,
        maxDepth,
      );
    });
  }

  applyCanopyYByTreeDepth([root], canvasHeight);
  applySubRowOffsets(root, subRowOffsets, canvasHeight);

  return { canvasWidth, canvasHeight, maxGeneration };
}

export function measureMemberBounds(members: PositionedMember[]) {
  return measureMembersBounds(members);
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
