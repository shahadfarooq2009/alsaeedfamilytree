import {
  cardFootprintForMember,
  cardWidthForMember,
  getBadgeOverhang,
  getBranchGap,
  getFamilyGroupGap,
  getSiblingGap,
  isFounderMember,
} from './constants';
import { MIN_CARD_GAP, measureMembersBounds, memberCardBBox, cardBoxesCollide } from './cardBounds';
import {
  applyReferenceCanopyYByTreeDepth,
  maxGenerationFromTree,
} from './generationYLayout';
import {
  layoutReferenceSymmetricTree,
  shouldUseReferenceSymmetricLayout,
} from './referenceSymmetricLayout';
import { computeRtlRowXs, placeSiblingRow, sortSiblingsByAddOrder } from './siblingOrder';
import { mainBranchUsableRect, usableStageRect, type LayoutStage } from './stageBounds';
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

function parentIdForGrouping(node: LayoutTreeNode): number {
  return node.primaryTreeParentId ?? node.fatherId ?? -1;
}

function groupByParent(nodes: LayoutTreeNode[]): Array<{ parentId: number; children: LayoutTreeNode[] }> {
  const map = new Map<number, LayoutTreeNode[]>();

  nodes.forEach((node) => {
    const parentId = parentIdForGrouping(node);
    const list = map.get(parentId) ?? [];
    list.push(node);
    map.set(parentId, list);
  });

  return Array.from(map.entries())
    .map(([parentId, children]) => ({
      parentId,
      children: sortSiblingsByAddOrder(children),
    }))
    .sort((a, b) => a.parentId - b.parentId);
}

function parentCenterX(parentId: number, nodeById: Map<number, LayoutTreeNode>, fallback: number): number {
  const parent = nodeById.get(parentId);
  if (!parent) return fallback;
  return parent.x + cardWidthForMember(parent) / 2;
}

function branchCenterX(branch: LayoutTreeNode): number {
  return branch.x + cardWidthForMember(branch) / 2;
}

function groupWidth(children: LayoutTreeNode[], siblingGap: number): number {
  if (children.length === 0) return 0;
  return children.reduce((sum, child) => sum + cardWidthForMember(child), 0)
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
  placeSiblingRow(children, left, siblingGap, cardWidthForMember);
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

/** Founder's direct children — one dense horizontal row across the canopy (reference image). */
function layoutFounderChildrenRow(
  children: LayoutTreeNode[],
  usable: ReturnType<typeof usableStageRect>,
): void {
  const ordered = sortSiblingsByAddOrder(children);
  const n = ordered.length;
  if (n === 0) return;

  const widths = ordered.map((child) => cardWidthForMember(child));
  const minBranchGap = Math.max(MIN_CARD_GAP, getSiblingGap(), Math.floor(getBranchGap() / 2));
  const totalCardWidth = widths.reduce((sum, width) => sum + width, 0);

  if (n === 1) {
    ordered[0].x = (usable.left + usable.right) / 2 - widths[0] / 2;
    return;
  }

  const minNeeded = totalCardWidth + (n - 1) * minBranchGap;

  if (minNeeded <= usable.width) {
    const gap = Math.max(minBranchGap, (usable.width - totalCardWidth) / (n - 1));
    const rowLeft = usable.left;
    const positions = computeRtlRowXs(rowLeft, widths, gap);
    ordered.forEach((child, index) => {
      child.x = positions[index];
    });
    return;
  }

  ordered.forEach((child, index) => {
    const centerX = usable.right - ((index + 0.5) / n) * usable.width;
    child.x = centerX - widths[index] / 2;
  });
}

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
  parentId: number;
  children: LayoutTreeNode[];
  width: number;
  idealLeft: number;
  left: number;
  twoRowChildren: boolean;
}

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
  const groups = groupByParent(nodes);

  const plans: FamilyGroupPlan[] = groups.map((group) => {
    const width = groupWidth(group.children, siblingGap);
    const parentX = parentCenterX(group.parentId, nodeById, zoneLeft + width / 2);
    return {
      parentId: group.parentId,
      children: group.children,
      width,
      idealLeft: parentX - width / 2,
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

/** Center each parent over the horizontal span of its direct children. */
function realignParentsOverChildren(root: LayoutTreeNode): void {
  const walk = (node: LayoutTreeNode): void => {
    node.children.forEach(walk);

    const children = node.children.filter((child) => child.id >= 0);
    if (children.length === 0) return;

    const minX = Math.min(...children.map((child) => child.x));
    const maxX = Math.max(
      ...children.map((child) => child.x + cardWidthForMember(child)),
    );
    const center = (minX + maxX) / 2;
    node.x = Math.round(center - cardWidthForMember(node) / 2);
  };
  walk(root);
}

export function layoutFounderTreeWithBranchZones(
  root: LayoutTreeNode,
  stage: LayoutStage,
  _maxClusterSize: number,
): BranchLayoutResult {
  const canvasWidth = stage.width;
  const canvasHeight = stage.height;

  if (shouldUseReferenceSymmetricLayout(root)) {
    const { maxGeneration } = layoutReferenceSymmetricTree(root, stage);
    return { canvasWidth, canvasHeight, maxGeneration };
  }

  const usable = usableStageRect(stage);
  const gen1Branches = sortSiblingsByAddOrder(root.children);
  const maxGeneration = maxGenerationFromTree([root]);
  const subRowOffsets = new Map<number, number>();
  const nodeById = indexNodes(root);
  const maxDepth = maxGeneration;

  root.x = canvasWidth / 2 - cardWidthForMember(root) / 2;

  if (gen1Branches.length > 0) {
    layoutFounderChildrenRow(gen1Branches, usable);

    const zones = branchZonesFromFounderChildren(gen1Branches, usable);
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

  applyReferenceCanopyYByTreeDepth([root], canvasHeight);
  applySubRowOffsets(root, subRowOffsets, canvasHeight);
  realignParentsOverChildren(root);

  return { canvasWidth, canvasHeight, maxGeneration };
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
      const parentsByDepth = new Map<number, Set<number>>();
      const walk = (node: LayoutTreeNode, depth: number): void => {
        const parentId = parentIdForGrouping(node);
        if (node.id >= 0 && parentId >= 0) {
          const set = parentsByDepth.get(depth) ?? new Set<number>();
          set.add(parentId);
          parentsByDepth.set(depth, set);
        }
        node.children.forEach((child) => walk(child, depth + 1));
      };
      walk(branch, 2);
      parentsByDepth.forEach((set) => {
        max = Math.max(max, set.size);
      });
    });
  });
  return max;
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

export function fitContentToStageCenter(
  members: PositionedMember[],
  stage: LayoutStage,
  widthFill = 0.8,
  heightFill = 0.56,
): PositionedMember[] {
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const targetW = stage.width * widthFill;
  const targetH = stage.height * heightFill;
  const scaleX = targetW / contentW;
  const scaleY = targetH / contentH;
  const scale = Math.min(2.4, Math.min(scaleX, scaleY));
  const stageCenterX = stage.width * 0.5;
  const stageCenterY = stage.height * 0.5;

  return members.map((member) => ({
    ...member,
    x: Math.round(stageCenterX + (member.x - centerX) * scale),
    y: Math.round(stageCenterY + (member.y - centerY) * scale),
  }));
}

export function ensureMembersWithinStage(
  members: PositionedMember[],
  stage: LayoutStage,
  marginX = 40,
  marginY = 56,
): PositionedMember[] {
  if (members.length === 0) return members;

  const maxW = Math.max(1, stage.width - marginX * 2);
  const maxH = Math.max(1, stage.height - marginY * 2);
  const bounds = measureMembersBounds(members);
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const stageCenterX = stage.width * 0.5;
  const stageCenterY = stage.height * 0.5;
  const scale = Math.min(1, maxW / contentW, maxH / contentH);

  return members.map((member) => ({
    ...member,
    x: Math.round(stageCenterX + (member.x - centerX) * scale),
    y: Math.round(stageCenterY + (member.y - centerY) * scale),
  }));
}

export function centerMembersInStage(
  members: PositionedMember[],
  stage: LayoutStage,
): PositionedMember[] {
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  const contentCenterX = (bounds.minX + bounds.maxX) / 2;
  const contentCenterY = (bounds.minY + bounds.maxY) / 2;
  const dx = Math.round(stage.width * 0.5 - contentCenterX);
  const dy = Math.round(stage.height * 0.5 - contentCenterY);

  if (dx === 0 && dy === 0) return members;
  return shiftMembers(members, dx, dy);
}

export function expandLayoutToFillStage(
  members: PositionedMember[],
  stage: LayoutStage,
  widthFill = 0.92,
  heightFill = 0.78,
): PositionedMember[] {
  const usable = mainBranchUsableRect(stage);
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const targetW = usable.width * widthFill;
  const targetH = usable.height * heightFill;

  const scaleX = Math.min(2.8, Math.max(1, targetW / contentW));
  const scaleY = Math.min(2.8, Math.max(1, targetH / contentH));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return members.map((member) => ({
    ...member,
    x: Math.round(centerX + (member.x - centerX) * scaleX),
    y: Math.round(centerY + (member.y - centerY) * scaleY),
  }));
}

export function spreadOverlappingMembersHorizontally(
  members: PositionedMember[],
  gap = MIN_CARD_GAP,
): PositionedMember[] {
  const resolved = members.map((member) => ({ ...member }));
  const rowTolerance = 10;
  const rows = new Map<number, PositionedMember[]>();

  resolved.forEach((member) => {
    const key = Math.round(member.y / rowTolerance);
    const list = rows.get(key) ?? [];
    list.push(member);
    rows.set(key, list);
  });

  rows.forEach((row) => {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index += 1) {
      const previous = row[index - 1];
      const current = row[index];
      const minX = previous.x + cardWidthForMember(previous) + gap;
      if (current.x < minX) {
        current.x = minX;
      }
    }
  });

  for (let pass = 0; pass < 16; pass += 1) {
    let moved = false;
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const a = resolved[i];
        const b = resolved[j];
        if (Math.abs(a.y - b.y) > rowTolerance) continue;
        const boxA = memberCardBBox(a);
        const boxB = memberCardBBox(b);
        if (!cardBoxesCollide(boxA, boxB, gap)) continue;

        const pushX = boxA.right + gap - boxB.left;
        if (pushX > 0) {
          b.x += pushX;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return resolved;
}

export function separateOverlappingCards(
  members: PositionedMember[],
): PositionedMember[] {
  return spreadOverlappingMembersHorizontally(members);
}

export function resolveSectorOverlaps(
  members: PositionedMember[],
  stage: LayoutStage,
): PositionedMember[] {
  void stage;
  return separateOverlappingCards(members);
}

export function enforceLayoutBounds(
  members: PositionedMember[],
  stage: LayoutStage,
): PositionedMember[] {
  const usable = mainBranchUsableRect(stage);
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  let dx = 0;
  let dy = 0;

  if (bounds.minX < usable.left) dx = usable.left - bounds.minX;
  if (bounds.maxX + dx > usable.right) dx = usable.right - bounds.maxX;
  if (bounds.minY + dy < usable.top) dy = usable.top - bounds.minY;
  if (bounds.maxY + dy > usable.bottom) dy = usable.bottom - bounds.maxY;

  if (dx === 0 && dy === 0) return members;
  return shiftMembers(members, dx, dy);
}

export function computeUnusedHorizontalSpace(
  members: PositionedMember[],
  stage: LayoutStage,
): { unusedLeftWidth: number; unusedRightWidth: number } {
  const usable = mainBranchUsableRect(stage);
  if (members.length === 0) {
    const half = usable.width / 2;
    return { unusedLeftWidth: half, unusedRightWidth: half };
  }

  const bounds = measureMembersBounds(members);
  return {
    unusedLeftWidth: Math.max(0, bounds.minX - usable.left),
    unusedRightWidth: Math.max(0, usable.right - bounds.maxX),
  };
}
