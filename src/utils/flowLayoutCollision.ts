import type { Edge, Node } from '@xyflow/react';

import {
  GEN5_ICON_SIZE,
  GEN5_NODE_HEIGHT,
  GEN5_NODE_WIDTH,
  gen5IconNodeId,
} from './gen5Expansion';
import type {
  FlowNodeData,
  FamilyTreeNodeData,
  Gen5IconNodeData,
  Gen5MemberNodeData,
} from './buildFamilyTreeFlowLayout';
import { isFounderMember, cardWidthForMember, cardFootprintForMember } from './treeLayout/constants';
import { MIN_CARD_GAP, measureMembersBounds } from './treeLayout/cardBounds';
import { sortSiblingsByAddOrder, computeRtlRowXs } from './treeLayout/siblingOrder';
import {
  resolveFamilyGroupRowOverlaps,
  resolveLayoutCollisionsWithinBranch,
} from './treeLayout/detectCollisions';
import { MAX_TREE_BRANCH_WIDTH } from './treeLayout/stageBounds';
import type { FamilyMemberInput, LayoutTreeNode, PositionedMember } from './treeLayout/types';

/** Rendered flow card sizes — must match FamilyTreeFlow.css. */
export const FLOW_FOUNDER_CARD = { width: 168, height: 118, badgeOverhang: 24 };
/** Wider root card in branch-map modals (gen-3 drill-down). */
export const FLOW_BRANCH_MAP_ROOT_CARD = { width: 220, height: 120, badgeOverhang: 24 };
export const FLOW_MEMBER_CARD = { width: 152, height: 108, badgeOverhang: 21 };
export const FLOW_MIN_GAP = Math.max(MIN_CARD_GAP, 14);
const FLOW_SUBROW_STEP = FLOW_MEMBER_CARD.height + FLOW_MIN_GAP + 12;

function branchGenerationRowKey(member: PositionedMember): string {
  const branch = member.mainBranchRootId ?? member.id;
  return `${member.generation}-${branch}`;
}

function rowRequiredWidth(row: PositionedMember[], gap: number): number {
  return row.reduce(
    (sum, member, index) => sum + cardWidthForMember(member) + (index > 0 ? gap : 0),
    0,
  );
}

/** Wrap only branch rows that exceed max width; preserve in-range sector positions. */
export function wrapMembersWithinMaxWidth(
  members: PositionedMember[],
  maxWidth = MAX_TREE_BRANCH_WIDTH,
  gap = FLOW_MIN_GAP,
): PositionedMember[] {
  const resolved = members.map((member) => ({ ...member }));
  const rows = new Map<string, PositionedMember[]>();

  resolved.forEach((member) => {
    const key = branchGenerationRowKey(member);
    const list = rows.get(key) ?? [];
    list.push(member);
    rows.set(key, list);
  });

  rows.forEach((row) => {
    row.sort((left, right) => left.x - right.x);

    const rowSpan = rowRequiredWidth(row, gap);
    const sectorMaxWidth = Math.max(
      cardWidthForMember(row[0]) + gap,
      Math.floor(maxWidth / 3) - gap,
    );
    const wrapLimit = Math.min(maxWidth, sectorMaxWidth);

    if (rowSpan <= wrapLimit) return;

    const subRows: PositionedMember[][] = [];
    let currentRow: PositionedMember[] = [];
    let rowWidth = 0;

    row.forEach((member) => {
      const cardWidth = cardWidthForMember(member);
      const needed = rowWidth === 0 ? cardWidth : rowWidth + gap + cardWidth;

      if (needed > wrapLimit && currentRow.length > 0) {
        subRows.push(currentRow);
        currentRow = [member];
        rowWidth = cardWidth;
        return;
      }

      currentRow.push(member);
      rowWidth = needed;
    });

    if (currentRow.length > 0) {
      subRows.push(currentRow);
    }

    const baseY = Math.min(...row.map((member) => member.y));
    const rowStep = Math.max(
      FLOW_SUBROW_STEP,
      cardFootprintForMember(row[0]) + gap,
    );
    const anchorX = Math.min(...row.map((member) => member.x));

    subRows.forEach((subRow, rowIndex) => {
      const ordered = sortSiblingsByAddOrder(subRow);
      const widths = ordered.map((member) => cardWidthForMember(member));
      const xs = computeRtlRowXs(anchorX, widths, gap);

      ordered.forEach((member, index) => {
        member.x = xs[index];
        member.y = Math.round(baseY - rowIndex * rowStep);
      });
    });
  });

  return resolved;
}

/** Scale down only when content is wider than the max column, then center. */
export function clampMembersToMaxWidth(
  members: PositionedMember[],
  maxWidth = MAX_TREE_BRANCH_WIDTH,
): PositionedMember[] {
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  const contentWidth = bounds.maxX - bounds.minX;
  if (contentWidth <= maxWidth) {
    return centerMembersInMaxWidth(members, maxWidth);
  }

  const scale = maxWidth / contentWidth;
  const centerX = (bounds.minX + bounds.maxX) / 2;

  const scaled = members.map((member) => ({
    ...member,
    x: Math.round((member.x - centerX) * scale + maxWidth / 2),
  }));

  return centerMembersInMaxWidth(scaled, maxWidth);
}

/** Center the laid-out tree inside the fixed max-width column. */
export function centerMembersInMaxWidth(
  members: PositionedMember[],
  maxWidth = MAX_TREE_BRANCH_WIDTH,
): PositionedMember[] {
  if (members.length === 0) return members;

  const bounds = measureMembersBounds(members);
  const contentWidth = bounds.maxX - bounds.minX;
  const offsetX = Math.round((maxWidth - contentWidth) / 2 - bounds.minX);

  if (offsetX === 0) return members;

  let shifted = members.map((member) => ({
    ...member,
    x: member.x + offsetX,
  }));

  const shiftedBounds = measureMembersBounds(shifted);
  if (shiftedBounds.minX < 0) {
    const fix = -shiftedBounds.minX;
    shifted = shifted.map((member) => ({
      ...member,
      x: member.x + fix,
    }));
  }

  return shifted;
}

export interface FlowLayoutRect {
  nodeId: string;
  kind: 'base' | 'gen5-icon' | 'gen5-member';
  memberId: number | null;
  parentMemberId: number | null;
  branchRootId: number | null;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FlowLayoutValidation {
  overlapCount: number;
  clippedCards: number;
  connectorIntersections: number;
  overlapPairs: Array<[string, string]>;
  valid: boolean;
}

function flowCardDimensions(member: FamilyMemberInput) {
  return isFounderMember(member)
    ? FLOW_FOUNDER_CARD
    : FLOW_MEMBER_CARD;
}

export function flowMemberRect(
  member: FamilyMemberInput,
  position: { x: number; y: number },
  branchRootId: number | null,
): FlowLayoutRect {
  const size = flowCardDimensions(member);
  return {
    nodeId: String(member.id),
    kind: 'base',
    memberId: member.id,
    parentMemberId: null,
    branchRootId,
    left: position.x,
    top: position.y - size.badgeOverhang,
    right: position.x + size.width,
    bottom: position.y + size.height,
    width: size.width,
    height: size.height + size.badgeOverhang,
  };
}

export function flowNodeRect(
  node: Node<FlowNodeData>,
  branchByMemberId: Map<number, number | null>,
): FlowLayoutRect | null {
  if (node.type === 'familyMember') {
    const data = node.data as FamilyTreeNodeData;
    const branchRootId = branchByMemberId.get(data.memberId) ?? null;
    return flowMemberRect(
      {
        id: data.memberId,
        fullName: data.fullName,
        fatherId: null,
        generation: data.generation,
        initial: data.initial,
      },
      node.position,
      branchRootId,
    );
  }

  if (node.type === 'gen5Icon') {
    const data = node.data as Gen5IconNodeData;
    const parentId = data.parentMemberId;
    return {
      nodeId: node.id,
      kind: 'gen5-icon',
      memberId: null,
      parentMemberId: parentId,
      branchRootId: branchByMemberId.get(parentId) ?? null,
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + GEN5_ICON_SIZE,
      bottom: node.position.y + GEN5_ICON_SIZE,
      width: GEN5_ICON_SIZE,
      height: GEN5_ICON_SIZE,
    };
  }

  if (node.type === 'gen5Member') {
    const data = node.data as Gen5MemberNodeData;
    const memberId = data.memberId;
    return {
      nodeId: node.id,
      kind: 'gen5-member',
      memberId,
      parentMemberId: null,
      branchRootId: branchByMemberId.get(memberId) ?? null,
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + GEN5_NODE_WIDTH,
      bottom: node.position.y + GEN5_NODE_HEIGHT,
      width: GEN5_NODE_WIDTH,
      height: GEN5_NODE_HEIGHT,
    };
  }

  return null;
}

function rectsCollide(a: FlowLayoutRect, b: FlowLayoutRect, gap = FLOW_MIN_GAP): boolean {
  return !(
    a.right + gap <= b.left
    || b.right + gap <= a.left
    || a.bottom + gap <= b.top
    || b.bottom + gap <= a.top
  );
}

function separationAmount(
  a: FlowLayoutRect,
  b: FlowLayoutRect,
  gap = FLOW_MIN_GAP,
): { dx: number; dy: number } {
  const overlapX = (a.right - a.left + (b.right - b.left)) / 2 + gap - Math.abs(
    (a.left + a.right) / 2 - (b.left + b.right) / 2,
  );
  const overlapY = (a.bottom - a.top + (b.bottom - b.top)) / 2 + gap - Math.abs(
    (a.top + a.bottom) / 2 - (b.top + b.top) / 2,
  );

  if (overlapX <= 0 && overlapY <= 0) return { dx: 0, dy: 0 };

  if (overlapX > 0 && (overlapX <= overlapY || overlapY <= 0)) {
    const dir = (a.left + a.right) / 2 <= (b.left + b.right) / 2 ? -1 : 1;
    return { dx: dir * overlapX, dy: 0 };
  }

  const dir = (a.top + a.bottom) / 2 <= (b.top + b.top) / 2 ? -1 : 1;
  return { dx: 0, dy: dir * overlapY };
}

function findOverlapPairs(rects: FlowLayoutRect[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (rectsCollide(rects[i], rects[j])) {
        pairs.push([rects[i].nodeId, rects[j].nodeId]);
      }
    }
  }
  return pairs;
}

function buildBranchMap(members: PositionedMember[]): Map<number, number | null> {
  return new Map(members.map((member) => [member.id, member.mainBranchRootId]));
}

function buildRects(
  nodes: Node<FlowNodeData>[],
  branchByMemberId: Map<number, number | null>,
  gen5ParentByChildId: Map<number, number>,
): FlowLayoutRect[] {
  return nodes.flatMap((node) => {
    if (node.type === 'gen5Member') {
      const data = node.data as Gen5MemberNodeData;
      const parentId = gen5ParentByChildId.get(data.memberId) ?? null;
      const branchRootId = parentId != null
        ? branchByMemberId.get(parentId) ?? null
        : branchByMemberId.get(data.memberId) ?? null;
      return [{
        nodeId: node.id,
        kind: 'gen5-member' as const,
        memberId: data.memberId,
        parentMemberId: parentId,
        branchRootId,
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + GEN5_NODE_WIDTH,
        bottom: node.position.y + GEN5_NODE_HEIGHT,
        width: GEN5_NODE_WIDTH,
        height: GEN5_NODE_HEIGHT,
      }];
    }
    const rect = flowNodeRect(node, branchByMemberId);
    return rect ? [rect] : [];
  });
}

function nodeById(nodes: Node<FlowNodeData>[]): Map<string, Node<FlowNodeData>> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function shiftNode(
  lookup: Map<string, Node<FlowNodeData>>,
  nodeId: string,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  const node = lookup.get(nodeId);
  if (!node) return;
  node.position = {
    x: node.position.x + dx,
    y: node.position.y + dy,
  };
}

function shiftGen5Cluster(
  lookup: Map<string, Node<FlowNodeData>>,
  parentId: number,
  gen5ChildIds: Set<number>,
  dx: number,
  dy: number,
): void {
  shiftNode(lookup, gen5IconNodeId(parentId), dx, dy);
  gen5ChildIds.forEach((childId) => {
    shiftNode(lookup, String(childId), dx, dy);
  });
}

function edgeSegments(
  source: FlowLayoutRect,
  target: FlowLayoutRect,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const sx = (source.left + source.right) / 2;
  const sy = source.bottom;
  const tx = (target.left + target.right) / 2;
  const ty = target.top;
  const midY = sy + (ty - sy) * 0.45;
  return [
    { x1: sx, y1: sy, x2: sx, y2: midY },
    { x1: sx, y1: midY, x2: tx, y2: midY },
    { x1: tx, y1: midY, x2: tx, y2: ty },
  ];
}

function segmentHitsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: FlowLayoutRect,
  padding = 4,
): boolean {
  const left = rect.left - padding;
  const right = rect.right + padding;
  const top = rect.top - padding;
  const bottom = rect.bottom + padding;

  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= left && x <= right && y >= top && y <= bottom) return true;
  }
  return false;
}

export function countConnectorCardIntersections(
  rects: FlowLayoutRect[],
  edges: Edge[],
): number {
  const byId = new Map(rects.map((rect) => [rect.nodeId, rect]));
  let count = 0;

  edges.forEach((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return;

    const segments = edgeSegments(source, target);
    segments.forEach((segment) => {
      rects.forEach((rect) => {
        if (rect.nodeId === edge.source || rect.nodeId === edge.target) return;
        if (segmentHitsRect(segment.x1, segment.y1, segment.x2, segment.y2, rect)) {
          count += 1;
        }
      });
    });
  });

  return count;
}

function countClippedCards(rects: FlowLayoutRect[], minX = -2000, minY = -2000): number {
  let count = 0;
  rects.forEach((rect) => {
    if (rect.left < minX || rect.top < minY) {
      count += 1;
    }
  });
  return count;
}

export function validateFlowLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  branchByMemberId: Map<number, number | null>,
  gen5ParentByChildId: Map<number, number>,
): FlowLayoutValidation {
  const rects = buildRects(nodes, branchByMemberId, gen5ParentByChildId);
  const overlapPairs = findOverlapPairs(rects);
  const connectorIntersections = countConnectorCardIntersections(rects, edges);

  return {
    overlapCount: overlapPairs.length,
    clippedCards: countClippedCards(rects),
    connectorIntersections,
    overlapPairs,
    valid: overlapPairs.length === 0 && connectorIntersections === 0,
  };
}

function syncMemberPosition(
  lookup: Map<string, Node<FlowNodeData>>,
  positionedById: Map<number, PositionedMember>,
  memberId: number,
  dx: number,
  dy: number,
): void {
  const positioned = positionedById.get(memberId);
  if (positioned) {
    positioned.x += dx;
    positioned.y += dy;
  }
  const node = lookup.get(String(memberId));
  if (node) {
    node.position = {
      x: node.position.x + dx,
      y: node.position.y + dy,
    };
  }
}

function resolveBaseFlowOverlaps(
  nodes: Node<FlowNodeData>[],
  positionedById: Map<number, PositionedMember>,
): boolean {
  const lookup = nodeById(nodes);
  const members = Array.from(positionedById.values());
  let moved = false;

  outer:
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const memberA = members[i];
      const memberB = members[j];
      const branchA = memberA.mainBranchRootId ?? memberA.id;
      const branchB = memberB.mainBranchRootId ?? memberB.id;
      if (branchA !== branchB) continue;

      const rectA = flowMemberRect(memberA, memberA, memberA.mainBranchRootId);
      const rectB = flowMemberRect(memberB, memberB, memberB.mainBranchRootId);
      if (!rectsCollide(rectA, rectB, FLOW_MIN_GAP)) continue;

      const { dx, dy } = separationAmount(rectA, rectB, FLOW_MIN_GAP);
      if (dy !== 0) {
        const moveDown = dy < 0;
        const target = moveDown ? memberB : memberA;
        const amount = Math.abs(dy);
        syncMemberPosition(lookup, positionedById, target.id, 0, moveDown ? amount : -amount);
        moved = true;
        break outer;
      }

      if (dx !== 0) {
        const moveRight = dx < 0;
        const target = moveRight ? memberB : memberA;
        const amount = Math.abs(dx);
        syncMemberPosition(
          lookup,
          positionedById,
          target.id,
          moveRight ? amount : -amount,
          0,
        );
        moved = true;
        break outer;
      }
    }
  }

  return moved;
}

export function strengthenBaseLayoutForFlowCards(
  members: PositionedMember[],
  roots: LayoutTreeNode[],
  _branchRootIds: ReadonlySet<number>,
): PositionedMember[] {
  let resolved = resolveFamilyGroupRowOverlaps(members, roots);
  resolved = resolveLayoutCollisionsWithinBranch(resolved, roots, 48);
  resolved = resolveFamilyGroupRowOverlaps(resolved, roots);
  return resolved;
}

export interface ResolveFlowLayoutContext {
  positionedById: Map<number, PositionedMember>;
  roots: LayoutTreeNode[];
  gen5ParentByChildId: Map<number, number>;
  gen5ChildrenByParent: Map<number, number[]>;
}

export function resolveFlowLayoutCollisions(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  context: ResolveFlowLayoutContext,
): Node<FlowNodeData>[] {
  const { gen5ParentByChildId, gen5ChildrenByParent } = context;
  const branchByMemberId = buildBranchMap(Array.from(context.positionedById.values()));
  const lookup = nodeById(nodes);

  for (let pass = 0; pass < 48; pass += 1) {
    const rects = buildRects(nodes, branchByMemberId, gen5ParentByChildId);
    let moved = false;

    outer:
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const rectA = rects[i];
        const rectB = rects[j];
        if (rectA.kind === 'base' && rectB.kind === 'base') continue;
        if (!rectsCollide(rectA, rectB)) continue;

        const { dx, dy } = separationAmount(rectA, rectB);
        if (dx === 0 && dy === 0) continue;

        const parentId = rectA.parentMemberId
          ?? rectB.parentMemberId
          ?? gen5ParentByChildId.get(rectA.memberId ?? -1)
          ?? gen5ParentByChildId.get(rectB.memberId ?? -1)
          ?? (rectA.kind === 'gen5-icon' ? Number(rectA.nodeId.replace('gen5-icon-', '')) : null)
          ?? (rectB.kind === 'gen5-icon' ? Number(rectB.nodeId.replace('gen5-icon-', '')) : null);

        if (parentId == null || !Number.isFinite(parentId)) continue;

        const childIds = new Set(gen5ChildrenByParent.get(parentId) ?? []);
        const preferUp = rectA.kind !== 'base' || rectB.kind !== 'base';
        const shiftX = dx !== 0 ? (dx < 0 ? Math.abs(dx) : -Math.abs(dx)) : 0;
        const shiftY = dy !== 0
          ? (preferUp && rectA.top <= rectB.top ? -Math.abs(dy) : Math.abs(dy))
          : 0;

        if (shiftX !== 0 || shiftY !== 0) {
          shiftGen5Cluster(lookup, parentId, childIds, shiftX, shiftY);
          moved = true;
          break outer;
        }
      }
    }

    if (!moved) {
      const connectorHits = countConnectorCardIntersections(
        buildRects(nodes, branchByMemberId, gen5ParentByChildId),
        edges,
      );
      if (connectorHits === 0) break;

      const gen5ParentIds = Array.from(gen5ChildrenByParent.keys());
      if (gen5ParentIds.length > 0) {
        const parentId = gen5ParentIds[pass % gen5ParentIds.length];
        const childIds = new Set(gen5ChildrenByParent.get(parentId) ?? []);
        shiftGen5Cluster(lookup, parentId, childIds, 0, FLOW_MIN_GAP);
        moved = true;
      }
    }

    if (!moved) break;
  }

  return nodes;
}

export function finalizeFlowLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  context: ResolveFlowLayoutContext,
): { nodes: Node<FlowNodeData>[]; validation: FlowLayoutValidation } {
  const branchByMemberId = buildBranchMap(Array.from(context.positionedById.values()));
  let resolved = nodes.map((node) => ({
    ...node,
    zIndex: node.type === 'familyMember' ? 10 : 9,
  }));

  for (let pass = 0; pass < 32; pass += 1) {
    const validation = validateFlowLayout(
      resolved,
      edges,
      branchByMemberId,
      context.gen5ParentByChildId,
    );

    if (validation.overlapCount === 0) {
      if (import.meta.env?.DEV) {
        console.info('[FamilyTreeFlow] layout validation', {
          overlapCount: 0,
          clippedCards: validation.clippedCards,
          connectorIntersections: validation.connectorIntersections,
          valid: validation.valid,
        });
      }
      return { nodes: resolved, validation };
    }

    const overlapBefore = validation.overlapCount;

    if (resolveBaseFlowOverlaps(resolved, context.positionedById)) {
      continue;
    }

    if (context.gen5ChildrenByParent.size > 0) {
      resolveFlowLayoutCollisions(resolved, edges, context);
    }

    const overlapAfter = validateFlowLayout(
      resolved,
      edges,
      branchByMemberId,
      context.gen5ParentByChildId,
    ).overlapCount;

    if (overlapAfter >= overlapBefore) {
      break;
    }
  }

  const validation = validateFlowLayout(
    resolved,
    edges,
    branchByMemberId,
    context.gen5ParentByChildId,
  );

  if (import.meta.env?.DEV) {
    console.info('[FamilyTreeFlow] layout validation', {
      overlapCount: validation.overlapCount,
      clippedCards: validation.clippedCards,
      connectorIntersections: validation.connectorIntersections,
      valid: validation.valid,
    });
    if (validation.overlapCount > 0) {
      console.warn('[FamilyTreeFlow] unresolved layout issues', validation);
    }
  }

  return { nodes: resolved, validation };
}
