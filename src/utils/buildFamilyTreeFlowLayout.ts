import type { Edge, Node } from '@xyflow/react';

import {
  chunkMembers,
  DEFAULT_MAX_BASE_GENERATIONS,
  filterBaseGenerationMembers,
  GEN5_GAP_X,
  GEN5_ICON_GAP,
  GEN5_ICON_SIZE,
  GEN5_NODE_HEIGHT,
  GEN5_NODE_WIDTH,
  GEN5_ROW_GAP,
  gen5IconNodeId,
  getGen4ParentsWithGen5Children,
  getDirectGen5Children,
  MAX_GEN5_PER_ROW,
  shouldShowGen5Cards,
  shouldShowGen5Icon,
} from './gen5Expansion';
import { buildFamilyTreeEdgeId } from './familyTreeFlowPath';
import type { BranchFamilyEdgeData } from './branchFamilyEdgePath';
import { getMemberFirstName } from './normalizeFamilyData';
import { getGenerationBaseline, getDisplayGeneration } from './progressiveTreeDisclosure';
import { getGenerationThemeClass } from './generationTheme';
import { buildFamilyHierarchy } from './treeLayout/buildFamilyHierarchy';
import { isFounderMember } from './treeLayout/constants';
import { compareSiblingsByAddOrder, computeRtlRowXs, sortSiblingsByAddOrder } from './treeLayout/siblingOrder';
import { computeDynamicTreeLayout } from './treeLayout/index';
import { maxGenerationFromMembers, computeCompactCanvasHeight } from './treeLayout/generationYLayout';
import { MAX_TREE_BRANCH_WIDTH } from './treeLayout/stageBounds';
import type { LayoutStage } from './treeLayout/stageBounds';
import { resolvePrimaryTreeParentId } from './treeLayout/primaryTreeParent';
import type { FamilyMemberInput, LayoutTreeNode, PositionedMember } from './treeLayout/types';
import {
  centerMembersInMaxWidth,
  finalizeFlowLayout,
  FLOW_FOUNDER_CARD,
  FLOW_BRANCH_MAP_ROOT_CARD,
  FLOW_MEMBER_CARD,
  FLOW_MIN_GAP,
  strengthenBaseLayoutForFlowCards,
  wrapMembersWithinMaxWidth,
} from './flowLayoutCollision';
import {
  resolveFamilyGroupRowOverlaps,
  resolveLayoutCollisions,
  resolveLayoutCollisionsWithinBranch,
} from './treeLayout/detectCollisions';

/** X positions for a sibling row: first-added (lowest id) is rightmost (RTL). */
function rtlXsById<T extends { id: number }>(
  items: T[],
  rowLeft: number,
  gap: number,
  widthFor: (item: T) => number,
): Map<number, number> {
  const ordered = sortSiblingsByAddOrder(items);
  const widths = ordered.map(widthFor);
  const xs = computeRtlRowXs(rowLeft, widths, gap);
  return new Map(ordered.map((item, index) => [item.id, xs[index]]));
}

function rtlRowLeft(centerX: number, totalWidth: number): number {
  return Math.round(centerX - totalWidth / 2);
}

export interface FamilyTreeNodeData extends Record<string, unknown> {
  memberId: number;
  fullName: string;
  displayName: string;
  initial: string;
  photoUrl?: string | null;
  childCount: number;
  hiddenChildCount: number;
  isExpandable: boolean;
  generation: number;
  generationClass: string;
  isFounder: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isJustAdded?: boolean;
  inSelectedPath: boolean;
  /** Branch map: left-to-right tree connectors. */
  horizontalLayout?: boolean;
}

export interface Gen5IconNodeData extends Record<string, unknown> {
  parentMemberId: number;
  childCount: number;
  isExpanded: boolean;
}

export interface Gen5MemberNodeData extends Record<string, unknown> {
  memberId: number;
  fullName: string;
  displayName: string;
  isEntering: boolean;
  isExiting: boolean;
  animationDelayMs: number;
}

export type FlowNodeData = FamilyTreeNodeData | Gen5IconNodeData | Gen5MemberNodeData;

export interface FamilyTreeLayoutOptions {
  allMembers?: FamilyMemberInput[];
  expandedGen5ParentIds?: ReadonlySet<number>;
  currentZoom?: number;
  gen5AnimatingParentIds?: ReadonlySet<number>;
  gen5ClosingParentIds?: ReadonlySet<number>;
  /** Branch map: render every generation as a full name card (no gen-5 micro nodes). */
  showAllGenerations?: boolean;
  /** Branch map: thin connector lines instead of thick trunk links. */
  thinEdges?: boolean;
  /** Branch map: root at top, descendants below (classic family tree). */
  topDown?: boolean;
  /** Branch map: tighten vertical spacing between generation rows. */
  compactVertical?: boolean;
  /** Branch map: only lay out members up to this generation (e.g. 2 = head + direct children). */
  maxVisibleGenerations?: number;
  /** Members used for child-count labels (defaults to allMembers). */
  childCountMembers?: FamilyMemberInput[];
  /** Branch map: max layout width (defaults to modal / viewport width). */
  layoutMaxWidth?: number;
  /** Branch map: max stack height for horizontal layout wrapping. */
  layoutMaxHeight?: number;
  /** Branch map: generations flow left → right instead of top → bottom. */
  branchHorizontalLayout?: boolean;
}

const FOUNDER_SIZE = { width: 168, height: 118, nameFontSize: 32 };
const MEMBER_SIZE = { width: 152, height: 108, nameFontSize: 30 };
const CHILDREN_FONT_SIZE = 20;
const CARD_HORIZONTAL_PAD = 28;

let cachedBaseLayout:
  | { signature: string; positioned: Map<number, PositionedMember> }
  | null = null;

function estimateLabelWidth(text: string, fontSize: number, charFactor = 0.58): number {
  return Math.ceil(text.length * fontSize * charFactor);
}

function nodeSize(member: FamilyMemberInput, childCount: number) {
  const isFounder = isFounderMember(member);
  const base = isFounder ? FOUNDER_SIZE : MEMBER_SIZE;
  const displayName = getMemberFirstName(member.fullName);
  const nameWidth = estimateLabelWidth(displayName, base.nameFontSize);
  const childrenWidth = estimateLabelWidth(`أبناء: ${childCount}`, CHILDREN_FONT_SIZE, 0.5);
  const width = Math.max(base.width, Math.max(nameWidth, childrenWidth) + CARD_HORIZONTAL_PAD);

  return {
    width,
    height: base.height,
    displayName,
  };
}

function computeFlowLayoutStage(
  memberCount: number,
  maxGeneration: number,
  compactVertical = false,
): LayoutStage {
  if (compactVertical) {
    const rowGap = 28;
    const cardFootprint = FLOW_MEMBER_CARD.height;
    const height = computeCompactCanvasHeight(maxGeneration, cardFootprint + rowGap, cardFootprint, 16);
    return {
      width: MAX_TREE_BRANCH_WIDTH,
      height: Math.max(480, height),
      paddingX: 16,
      paddingY: 16,
    };
  }

  return {
    width: MAX_TREE_BRANCH_WIDTH,
    height: Math.max(2400, maxGeneration * 440, memberCount * 44),
    paddingX: 16,
    paddingY: 20,
  };
}

function flowCardDimensions(member: FamilyMemberInput) {
  return isFounderMember(member) ? FLOW_FOUNDER_CARD : FLOW_MEMBER_CARD;
}

function flowBranchMapRootCardWidth(
  member: FamilyMemberInput | PositionedMember,
  depthById: Map<number, number>,
): number {
  return isBranchMapRoot(member, depthById)
    ? FLOW_BRANCH_MAP_ROOT_CARD.width
    : isFounderMember(member)
      ? FLOW_FOUNDER_CARD.width
      : 0;
}

function flowCardDimensionsForBranchEdge(
  member: FamilyMemberInput | PositionedMember,
  branchMapRootId: number | null,
): { width: number; height: number } {
  if (branchMapRootId != null && member.id === branchMapRootId) {
    return FLOW_BRANCH_MAP_ROOT_CARD;
  }
  return flowCardDimensions(member);
}

function buildBranchFamilyEdgeMetadata(
  baseMembers: FamilyMemberInput[],
  positionedById: Map<number, PositionedMember>,
  branchMapRootId: number | null = null,
): Map<string, BranchFamilyEdgeData> {
  const edgeDataById = new Map<string, BranchFamilyEdgeData>();
  const childrenByParent = buildDirectChildrenMap(baseMembers);
  const LINE_PAD = 12;

  childrenByParent.forEach((children, parentId) => {
    const parent = positionedById.get(parentId);
    if (!parent || children.length === 0) return;

    const parentSize = flowCardDimensionsForBranchEdge(parent, branchMapRootId);
    const trunkX = parent.x + parentSize.width / 2;
    const parentBottom = parent.y + parentSize.height;

    const childEntries = children
      .map((child) => {
        const pos = positionedById.get(child.id);
        if (!pos) return null;
        const size = flowCardDimensions(pos);
        return {
          child,
          dropX: pos.x + size.width / 2,
          topY: pos.y,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    if (childEntries.length === 0) return;

    const minChildTop = Math.min(...childEntries.map((entry) => entry.topY));
    const gap = minChildTop - parentBottom;
    const busY = gap <= LINE_PAD * 2
      ? parentBottom + Math.max(6, gap / 2)
      : Math.min(
        parentBottom + gap - LINE_PAD,
        Math.max(parentBottom + LINE_PAD, parentBottom + gap * 0.5),
      );

    const dropXs = childEntries.map((entry) => entry.dropX);
    const busMinX = Math.min(...dropXs);
    const busMaxX = Math.max(...dropXs);

    const sorted = [...childEntries].sort((left, right) => left.dropX - right.dropX);
    const primaryChildId = sorted[0].child.id;

    childEntries.forEach((entry) => {
      const edgeId = buildFamilyTreeEdgeId(parentId, entry.child.id);
      const isPrimary = entry.child.id === primaryChildId;

      edgeDataById.set(edgeId, {
        routing: 'classic',
        busY,
        trunkX,
        dropX: entry.dropX,
        busMinX,
        busMaxX,
        segment: isPrimary ? 'trunkBusDrop' : 'dropOnly',
      });
    });
  });

  return edgeDataById;
}

function flipPositionsTopDown(
  positionedById: Map<number, PositionedMember>,
): Map<number, PositionedMember> {
  const members = [...positionedById.values()];
  if (members.length === 0) return positionedById;

  let minY = Infinity;
  let maxY = -Infinity;
  members.forEach((member) => {
    minY = Math.min(minY, member.y);
    maxY = Math.max(maxY, member.y);
  });

  const flipped = new Map<number, PositionedMember>();
  members.forEach((member) => {
    flipped.set(member.id, {
      ...member,
      y: minY + (maxY - member.y),
    });
  });
  return flipped;
}

function buildMainEdgeStyle(thinEdges: boolean) {
  if (thinEdges) {
    return {
      stroke: '#8a9a82',
      strokeWidth: 1.1,
      opacity: 0.5,
    };
  }
  return {
    stroke: '#5c4828',
    strokeWidth: 3.75,
  };
}

/** Vertical gap between parent card and child row. */
const BRANCH_DEPTH_GAP = 50;
const BRANCH_TOP_PADDING = 16;
const BRANCH_LEFT_PADDING = 16;
/** Vertical gap between wrapped sibling rows. */
const BRANCH_ROW_GAP = 34;
/** Horizontal gap between sibling cards in branch map (clears card shadow). */
const BRANCH_MAP_SIBLING_GAP = 40;
/** Max direct children per row under the same parent (default generations). */
const BRANCH_CHILDREN_PER_ROW = 4;
/** Gen-2 branch heads (green row under founder): up to 6 per row. */
const GEN2_BRANCH_HEADS_PER_ROW = 6;
/** Generation 4: up to 6 cards per row, at most 6 rows. */
const GEN4_CARDS_PER_ROW = 6;
const GEN4_MAX_ROWS = 6;
/** Extra gap between gen-2 branch columns (cousin groups). */
const BRANCH_COLUMN_GAP_EXTRA = 56;
const GEN2_SIBLING_ROW_GAP = 28;

function measurePositionedBlockBounds(
  positioned: Map<number, PositionedMember>,
  childCountById?: Map<number, number>,
  fallbackWidth = FLOW_MEMBER_CARD.width,
): { width: number; height: number; top: number; bottom: number } {
  const cardH = FLOW_MEMBER_CARD.height;
  const badge = FLOW_MEMBER_CARD.badgeOverhang;

  if (positioned.size === 0) {
    return { width: fallbackWidth, height: cardH + badge, top: 0, bottom: cardH };
  }

  let minTop = Infinity;
  let maxBottom = -Infinity;
  let maxRight = 0;

  positioned.forEach((pos) => {
    const cardW = childCountById
      ? Math.max(FLOW_MEMBER_CARD.width, layoutCardWidth(pos, childCountById))
      : (isFounderMember(pos) ? FLOW_FOUNDER_CARD.width : FLOW_MEMBER_CARD.width);
    minTop = Math.min(minTop, pos.y - badge);
    maxBottom = Math.max(maxBottom, pos.y + cardH);
    maxRight = Math.max(maxRight, pos.x + cardW);
  });

  return {
    width: Math.max(fallbackWidth, maxRight),
    top: minTop,
    bottom: maxBottom,
    height: maxBottom - minTop,
  };
}

interface ChildColumnLayout {
  width: number;
  height: number;
  positioned: Map<number, PositionedMember>;
}

function sumRowWidth(
  items: Array<{ width: number }>,
  columnGap: number,
): number {
  if (items.length === 0) return 0;
  return items.reduce(
    (sum, item, index) => sum + item.width + (index > 0 ? columnGap : 0),
    0,
  );
}

interface BranchColumnLayout {
  width: number;
  headOffsetX: number;
  descendants: Map<number, PositionedMember>;
}

function splitBranchBlockHeadAndDescendants(
  block: { width: number; height: number; positioned: Map<number, PositionedMember> },
  branchRootId: number,
): BranchColumnLayout {
  const cardW = FLOW_MEMBER_CARD.width;
  const cardH = FLOW_MEMBER_CARD.height;
  const headPos = block.positioned.get(branchRootId);
  const headOffsetX = headPos?.x ?? Math.max(0, block.width / 2 - cardW / 2);
  const descendants = new Map<number, PositionedMember>();
  const descendantsTop = cardH + BRANCH_DEPTH_GAP;

  block.positioned.forEach((pos, id) => {
    if (id === branchRootId) return;
    descendants.set(id, {
      ...pos,
      y: Math.round(pos.y - descendantsTop),
    });
  });

  return {
    width: block.width,
    headOffsetX,
    descendants,
  };
}

function wrapGen2ColumnsIntoRows<T>(items: T[], perRow = GEN2_BRANCH_HEADS_PER_ROW): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += perRow) {
    rows.push(items.slice(index, index + perRow));
  }
  return rows;
}

function shouldWrapGen2BranchHeadRows(itemCount: number): boolean {
  return itemCount > GEN2_BRANCH_HEADS_PER_ROW;
}

function measureGen2RowSpan(
  row: Array<{ descendants: Map<number, PositionedMember> }>,
  rowHeadY: number,
): number {
  const cardH = FLOW_MEMBER_CARD.height;
  const descendantsY = rowHeadY + cardH + BRANCH_DEPTH_GAP;
  let maxBottom = rowHeadY + cardH;

  row.forEach((column) => {
    column.descendants.forEach((pos) => {
      maxBottom = Math.max(maxBottom, descendantsY + pos.y + cardH);
    });
  });

  return maxBottom - rowHeadY;
}

function layoutChildColumn(
  child: FamilyMemberInput,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  depth: number,
  maxDepth: number,
  gap: number,
  maxCardsPerRow: number,
  childCountById: Map<number, number>,
  branchRootByMemberId?: Map<number, number | null>,
): ChildColumnLayout {
  const cardW = FLOW_MEMBER_CARD.width;
  const grandchildren = depth < maxDepth ? (childrenByParent.get(child.id) ?? []) : [];

  if (grandchildren.length === 0) {
    const positioned = new Map<number, PositionedMember>();
    positioned.set(child.id, toPositionedMember(child, 0, 0, branchRootByMemberId));
    const bounds = measurePositionedBlockBounds(positioned, childCountById);
    return { width: bounds.width, height: bounds.height, positioned };
  }

  const block = layoutMemberBlock(
    child,
    childrenByParent,
    depth,
    maxDepth,
    gap,
    maxCardsPerRow,
    childCountById,
    branchRootByMemberId,
  );
  const bounds = measurePositionedBlockBounds(block.positioned, childCountById);
  return {
    width: bounds.width,
    height: bounds.height,
    positioned: block.positioned,
  };
}

function groupMembersByDepth(
  positionedById: Map<number, PositionedMember>,
  roots: LayoutTreeNode[],
): Map<number, PositionedMember[]> {
  const depthById = new Map<number, number>();
  const walk = (node: LayoutTreeNode, depth: number): void => {
    if (node.id >= 0) depthById.set(node.id, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 1));

  const byDepth = new Map<number, PositionedMember[]>();
  positionedById.forEach((member) => {
    const depth = depthById.get(member.id);
    if (depth == null) return;
    const list = byDepth.get(depth) ?? [];
    list.push(member);
    byDepth.set(depth, list);
  });
  return byDepth;
}

function flowCardWidth(member: PositionedMember): number {
  return isFounderMember(member) ? FLOW_FOUNDER_CARD.width : FLOW_MEMBER_CARD.width;
}

function wrapMembersIntoRows(
  members: PositionedMember[],
  maxRowWidth: number,
  gap: number,
): PositionedMember[][] {
  const sorted = [...members].sort((left, right) => left.x - right.x || left.id - right.id);
  const rows: PositionedMember[][] = [];
  let currentRow: PositionedMember[] = [];
  let rowWidth = 0;

  sorted.forEach((member) => {
    const width = flowCardWidth(member);
    const needed = rowWidth === 0 ? width : rowWidth + gap + width;

    if (needed > maxRowWidth && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [member];
      rowWidth = width;
      return;
    }

    currentRow.push(member);
    rowWidth = needed;
  });

  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

/** Tight vertical rows with guaranteed horizontal spacing — no card overlap. */
function compactVerticalByDepth(
  positionedById: Map<number, PositionedMember>,
  roots: LayoutTreeNode[],
  maxRowWidth = MAX_TREE_BRANCH_WIDTH,
): Map<number, PositionedMember> {
  const byDepth = groupMembersByDepth(positionedById, roots);
  const depths = [...byDepth.keys()].sort((left, right) => left - right);
  const compacted = new Map<number, PositionedMember>();
  let currentTop = BRANCH_TOP_PADDING;
  const gap = FLOW_MIN_GAP;
  const rowStep = FLOW_MEMBER_CARD.height + gap;

  depths.forEach((depth, depthIndex) => {
    const packedRows = wrapMembersIntoRows(byDepth.get(depth) ?? [], maxRowWidth, gap);

    packedRows.forEach((row, rowIndex) => {
      const totalWidth = row.reduce(
        (sum, member, index) => sum + flowCardWidth(member) + (index > 0 ? gap : 0),
        0,
      );
      const rowLeft = Math.max(0, Math.round((maxRowWidth - totalWidth) / 2));
      const xsById = rtlXsById(row, rowLeft, gap, flowCardWidth);
      const rowY = currentTop + rowIndex * rowStep;

      row.forEach((member) => {
        compacted.set(member.id, { ...member, x: xsById.get(member.id) ?? member.x, y: rowY });
      });
    });

    const depthCardHeight = depthIndex === 0
      ? FLOW_FOUNDER_CARD.height
      : FLOW_MEMBER_CARD.height;
    const depthRows = Math.max(1, packedRows.length);
    currentTop += depthCardHeight + (depthRows - 1) * rowStep + BRANCH_DEPTH_GAP;
  });

  return compacted;
}

function resolveBranchMapCollisions(
  positionedById: Map<number, PositionedMember>,
  roots: LayoutTreeNode[],
  maxRowWidth = MAX_TREE_BRANCH_WIDTH,
): Map<number, PositionedMember> {
  let members = [...positionedById.values()];
  members = resolveFamilyGroupRowOverlaps(members, roots);
  members = resolveLayoutCollisions(members, roots, 200);
  members = resolveFamilyGroupRowOverlaps(members, roots);
  members = resolveLayoutCollisionsWithinBranch(members, roots, 128);
  members = resolveFamilyGroupRowOverlaps(members, roots);
  members = resolveLayoutCollisions(members, roots, 104);
  members = centerMembersInMaxWidth(members, maxRowWidth);
  return new Map(members.map((member) => [member.id, member]));
}

function buildDirectChildrenMap(members: FamilyMemberInput[]): Map<number, FamilyMemberInput[]> {
  const map = new Map<number, FamilyMemberInput[]>();

  members.forEach((member) => {
    const parentId = resolvePrimaryTreeParentId(member);
    if (parentId == null) return;
    const list = map.get(parentId) ?? [];
    list.push(member);
    map.set(parentId, list);
  });

  map.forEach((children) => {
    children.sort(compareSiblingsByAddOrder);
  });

  return map;
}

function wrapMemberInputsIntoRows(
  members: FamilyMemberInput[],
  maxPerRow: number,
): FamilyMemberInput[][] {
  const rows: FamilyMemberInput[][] = [];
  for (let index = 0; index < members.length; index += maxPerRow) {
    rows.push(members.slice(index, index + maxPerRow));
  }
  return rows;
}

/** How many siblings fit on one row — generation 4 allows 6 per row, max 6 rows. */
function maxCardsPerRowForChildDepth(childDepth: number, childCount: number): number {
  if (childDepth !== 4 || childCount <= 0) {
    return BRANCH_CHILDREN_PER_ROW;
  }
  const perRowForRowCap = Math.ceil(childCount / GEN4_MAX_ROWS);
  return Math.max(GEN4_CARDS_PER_ROW, perRowForRowCap);
}

function rowPixelWidth(cardCount: number, gap: number): number {
  if (cardCount <= 0) return 0;
  return cardCount * FLOW_MEMBER_CARD.width + (cardCount - 1) * gap;
}

function toPositionedMember(
  member: FamilyMemberInput,
  x: number,
  y: number,
  branchRootByMemberId?: Map<number, number | null>,
): PositionedMember {
  const parentId = resolvePrimaryTreeParentId(member);
  return {
    ...member,
    x: Math.round(x),
    y: Math.round(y),
    primaryTreeParentId: parentId,
    mainBranchRootId: branchRootByMemberId?.get(member.id)
      ?? (isFounderMember(member) ? null : parentId ?? member.id),
  };
}

/** Horizontal footprint used for branch-map spacing (includes label padding). */
function layoutCardWidth(
  member: FamilyMemberInput,
  childCountById: Map<number, number>,
): number {
  return nodeSize(member, childCountById.get(member.id) ?? 0).width;
}

function layoutCardStep(
  member: FamilyMemberInput,
  childCountById: Map<number, number>,
  gap: number,
): number {
  return layoutCardWidth(member, childCountById) + gap;
}

function buildChildCountById(
  childrenByParent: Map<number, FamilyMemberInput[]>,
): Map<number, number> {
  const childCountById = new Map<number, number>();
  childrenByParent.forEach((children, parentId) => {
    childCountById.set(parentId, children.length);
  });
  return childCountById;
}

/** Card footprint used for branch-map spacing (never smaller than rendered CSS card). */
function branchCardWidth(
  member: FamilyMemberInput,
  childCountById: Map<number, number>,
): number {
  return Math.max(FLOW_MEMBER_CARD.width, layoutCardWidth(member, childCountById));
}

function collectDescendantIds(
  rootId: number,
  childrenByParent: Map<number, FamilyMemberInput[]>,
): Set<number> {
  const ids = new Set<number>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of childrenByParent.get(id) ?? []) {
      ids.add(child.id);
      stack.push(child.id);
    }
  }
  return ids;
}

function measureSubtreeBounds(
  rootId: number,
  positioned: Map<number, PositionedMember>,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  childCountById: Map<number, number>,
): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  const ids = new Set<number>([rootId, ...collectDescendantIds(rootId, childrenByParent)]);
  const cardH = FLOW_MEMBER_CARD.height;
  const badge = FLOW_MEMBER_CARD.badgeOverhang;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  ids.forEach((id) => {
    const pos = positioned.get(id);
    if (!pos) return;
    const cardW = isFounderMember(pos)
      ? FLOW_FOUNDER_CARD.width
      : branchCardWidth(pos, childCountById);
    const cardHeight = isFounderMember(pos) ? FLOW_FOUNDER_CARD.height : cardH;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + cardW);
    minY = Math.min(minY, pos.y - badge);
    maxY = Math.max(maxY, pos.y + cardHeight);
  });

  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function shiftMemberAndDescendants(
  positioned: Map<number, PositionedMember>,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  rootId: number,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  const ids = new Set<number>([rootId, ...collectDescendantIds(rootId, childrenByParent)]);
  ids.forEach((id) => {
    const pos = positioned.get(id);
    if (!pos) return;
    positioned.set(id, {
      ...pos,
      x: Math.round(pos.x + dx),
      y: Math.round(pos.y + dy),
    });
  });
}

/**
 * Re-wrap each parent's direct children into rows of maxPerRow.
 * Spacing uses full subtree width so cousin columns never collide.
 */
function relayoutParentChildrenGroups(
  positioned: Map<number, PositionedMember>,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  childCountById: Map<number, number>,
  depthById: Map<number, number>,
  gap: number,
): void {
  const parentCardH = FLOW_MEMBER_CARD.height;
  const founderCardH = FLOW_FOUNDER_CARD.height;

  const parentIds = [...childrenByParent.keys()].filter((parentId) => positioned.has(parentId));
  parentIds.sort((left, right) => {
    const maxChildY = (parentId: number) => Math.max(
      0,
      ...(childrenByParent.get(parentId) ?? []).map((child) => positioned.get(child.id)?.y ?? 0),
    );
    return maxChildY(right) - maxChildY(left);
  });

  parentIds.forEach((parentId) => {
    const children = childrenByParent.get(parentId) ?? [];
    if (children.length === 0) return;

    const parent = positioned.get(parentId);
    if (!parent) return;

    const positionedChildren = children.filter((child) => positioned.has(child.id));
    if (positionedChildren.length === 0) return;

    const parentDepth = depthById.get(parentId) ?? 1;
    const childDepth = parentDepth + 1;
    const cardsPerRow = maxCardsPerRowForChildDepth(childDepth, positionedChildren.length);
    const childRows = wrapMemberInputsIntoRows(positionedChildren, cardsPerRow);
    const parentCardW = isFounderMember(parent)
      ? FLOW_FOUNDER_CARD.width
      : FLOW_MEMBER_CARD.width;
    const parentCardHeight = isFounderMember(parent) ? founderCardH : parentCardH;
    const parentCenterX = parent.x + parentCardW / 2;
    let rowAnchorY = parent.y + parentCardHeight + BRANCH_DEPTH_GAP;

    childRows.forEach((row) => {
      const rowSpans = row.map((child) =>
        measureSubtreeBounds(child.id, positioned, childrenByParent, childCountById),
      );
      const rowWidth = rowSpans.reduce(
        (sum, span, index) => sum + span.width + (index > 0 ? gap : 0),
        0,
      );
      const rowLeft = rtlRowLeft(parentCenterX, rowWidth);
      const slotXsById = rtlXsById(
        row,
        rowLeft,
        gap,
        (child) => measureSubtreeBounds(child.id, positioned, childrenByParent, childCountById).width,
      );

      row.forEach((child) => {
        const current = positioned.get(child.id);
        if (!current) return;

        const span = measureSubtreeBounds(child.id, positioned, childrenByParent, childCountById);
        const slotX = slotXsById.get(child.id) ?? span.minX;
        const dx = Math.round(slotX - span.minX);
        const dy = Math.round(rowAnchorY - current.y);
        shiftMemberAndDescendants(positioned, childrenByParent, child.id, dx, dy);
      });

      const rowBottom = Math.max(
        ...row.map((child) =>
          measureSubtreeBounds(child.id, positioned, childrenByParent, childCountById).maxY,
        ),
      );
      rowAnchorY = rowBottom + BRANCH_DEPTH_GAP;
    });
  });
}

/** Ensure siblings on the same row under one parent never overlap — uses full subtree width. */
function enforceSiblingGroupSpacing(
  positioned: Map<number, PositionedMember>,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  childCountById: Map<number, number>,
  gap: number,
): void {
  const rowYTolerance = 8;

  childrenByParent.forEach((children) => {
    const siblings = children
      .map((child) => positioned.get(child.id))
      .filter((child): child is PositionedMember => child != null);
    if (siblings.length < 2) return;

    const rows: PositionedMember[][] = [];
    const sorted = [...siblings].sort((left, right) => left.y - right.y || left.x - right.x);

    sorted.forEach((sibling) => {
      const row = rows.find((group) => Math.abs(group[0].y - sibling.y) <= rowYTolerance);
      if (row) row.push(sibling);
      else rows.push([sibling]);
    });

    rows.forEach((row) => {
      row.sort((left, right) => left.x - right.x);

      for (let index = 1; index < row.length; index += 1) {
        const prev = row[index - 1];
        const sibling = row[index];
        const prevBounds = measureSubtreeBounds(prev.id, positioned, childrenByParent, childCountById);
        const siblingBounds = measureSubtreeBounds(sibling.id, positioned, childrenByParent, childCountById);
        const neededShift = Math.ceil(prevBounds.maxX + gap - siblingBounds.minX);

        if (neededShift > 0) {
          shiftMemberAndDescendants(positioned, childrenByParent, sibling.id, neededShift, 0);
          sibling.x += neededShift;
        }
      }
    });
  });
}

function buildBranchRootByMemberId(roots: LayoutTreeNode[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  const walk = (node: LayoutTreeNode): void => {
    map.set(node.id, node.mainBranchRootId);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return map;
}

function layoutMemberBlock(
  member: FamilyMemberInput,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  depth: number,
  maxDepth: number,
  gap: number,
  maxCardsPerRow: number,
  childCountById: Map<number, number>,
  branchRootByMemberId?: Map<number, number | null>,
): {
  width: number;
  height: number;
  positioned: Map<number, PositionedMember>;
} {
  const positioned = new Map<number, PositionedMember>();
  const cardW = layoutCardWidth(member, childCountById);
  const cardH = FLOW_MEMBER_CARD.height;
  const badge = FLOW_MEMBER_CARD.badgeOverhang;
  const children = depth < maxDepth ? (childrenByParent.get(member.id) ?? []) : [];
  const place = (node: FamilyMemberInput, x: number, y: number) => {
    positioned.set(node.id, toPositionedMember(node, x, y, branchRootByMemberId));
  };

  if (children.length === 0) {
    place(member, 0, 0);
    const bounds = measurePositionedBlockBounds(positioned, childCountById, cardW);
    return { width: bounds.width, height: bounds.height, positioned };
  }

  const nextDepth = depth + 1;
  const cardsPerRow = maxCardsPerRowForChildDepth(nextDepth, children.length);
  const childRows = wrapMemberInputsIntoRows(children, cardsPerRow);
  const childHasDescendants = children.some(
    (child) => nextDepth < maxDepth && (childrenByParent.get(child.id)?.length ?? 0) > 0,
  );

  if (!childHasDescendants) {
    const rowWidths = childRows.map((row) =>
      row.reduce(
        (sum, child, index) => sum + branchCardWidth(child, childCountById) + (index > 0 ? gap : 0),
        0,
      ),
    );
    const blockWidth = Math.max(cardW, ...rowWidths, 0);
    const rowStride = cardH + badge + BRANCH_ROW_GAP;

    place(member, blockWidth / 2 - cardW / 2, 0);

    const childBaseY = cardH + BRANCH_DEPTH_GAP;
    childRows.forEach((row, rowIndex) => {
      const rowWidth = row.reduce(
        (sum, child, index) => sum + branchCardWidth(child, childCountById) + (index > 0 ? gap : 0),
        0,
      );
      const rowLeft = blockWidth / 2 - rowWidth / 2;
      const xsById = rtlXsById(
        row,
        rowLeft,
        gap,
        (child) => branchCardWidth(child, childCountById),
      );
      const y = childBaseY + rowIndex * rowStride;

      row.forEach((child) => {
        place(child, xsById.get(child.id) ?? rowLeft, y);
      });
    });

    const bounds = measurePositionedBlockBounds(positioned, childCountById, blockWidth);
    return { width: bounds.width, height: Math.max(cardH, bounds.bottom), positioned };
  }

  const childColumns = new Map(
    children.map((child) => [
      child.id,
      layoutChildColumn(
        child,
        childrenByParent,
        nextDepth,
        maxDepth,
        gap,
        maxCardsPerRowForChildDepth(
          nextDepth + 1,
          (childrenByParent.get(child.id) ?? []).length,
        ),
        childCountById,
        branchRootByMemberId,
      ),
    ]),
  );

  const rowWidths = childRows.map((row) => {
    const slotWidths = row.map((child) => {
      const bounds = measurePositionedBlockBounds(childColumns.get(child.id)!.positioned, childCountById);
      return Math.max(branchCardWidth(child, childCountById), bounds.width);
    });
    return slotWidths.reduce(
      (sum, slotWidth, index) => sum + slotWidth + (index > 0 ? gap : 0),
      0,
    );
  });
  const blockWidth = Math.max(cardW, ...rowWidths, 0);

  place(member, blockWidth / 2 - cardW / 2, 0);

  let cursorY = cardH + BRANCH_DEPTH_GAP;
  childRows.forEach((row, rowIndex) => {
    const slotWidths = row.map((child) => {
      const bounds = measurePositionedBlockBounds(childColumns.get(child.id)!.positioned, childCountById);
      return Math.max(branchCardWidth(child, childCountById), bounds.width);
    });
    const rowWidth = slotWidths.reduce(
      (sum, slotWidth, index) => sum + slotWidth + (index > 0 ? gap : 0),
      0,
    );
    const rowLeft = blockWidth / 2 - rowWidth / 2;
    const slotXsById = rtlXsById(
      row,
      rowLeft,
      gap,
      (child) => slotWidths[row.indexOf(child)],
    );
    const rowVisualHeight = Math.max(
      cardH + badge,
      ...row.map((child) => measurePositionedBlockBounds(childColumns.get(child.id)!.positioned, childCountById).height),
    );

    row.forEach((child, slotIndex) => {
      const column = childColumns.get(child.id)!;
      const slotWidth = slotWidths[slotIndex];
      const columnBounds = measurePositionedBlockBounds(column.positioned, childCountById);
      const slotX = slotXsById.get(child.id) ?? rowLeft;
      const columnOffsetX = slotX + Math.max(0, (slotWidth - columnBounds.width) / 2);

      column.positioned.forEach((pos, id) => {
        positioned.set(id, {
          ...pos,
          x: Math.round(columnOffsetX + pos.x),
          y: Math.round(cursorY + pos.y),
        });
      });
    });

    cursorY += rowVisualHeight;
    if (rowIndex < childRows.length - 1) {
      cursorY += BRANCH_ROW_GAP;
    }
  });

  const blockBounds = measurePositionedBlockBounds(positioned, childCountById, blockWidth);
  return { width: blockBounds.width, height: Math.max(cardH, blockBounds.bottom), positioned };
}

function realignParentsOverChildrenInMap(
  positioned: Map<number, PositionedMember>,
  roots: LayoutTreeNode[],
  childrenByParent: Map<number, FamilyMemberInput[]>,
  childCountById: Map<number, number>,
): void {
  const depthById = buildMemberDepthById(roots);

  const walk = (node: LayoutTreeNode): void => {
    node.children.forEach(walk);
    const children = node.children.filter((child) => child.id >= 0);
    if (children.length === 0) return;

    const parent = positioned.get(node.id);
    if (!parent) return;

    const childBoxes = children
      .map((child) => positioned.get(child.id))
      .filter((child): child is PositionedMember => child != null);
    if (childBoxes.length === 0) return;

    const childBounds = childBoxes.map((child) =>
      measureSubtreeBounds(child.id, positioned, childrenByParent, childCountById),
    );
    const minX = Math.min(...childBounds.map((bounds) => bounds.minX));
    const maxX = Math.max(...childBounds.map((bounds) => bounds.maxX));
    const branchRootW = flowBranchMapRootCardWidth(parent, depthById);
    const parentW = branchRootW > 0
      ? branchRootW
      : branchCardWidth(parent, childCountById);
    parent.x = Math.round((minX + maxX) / 2 - parentW / 2);
  };

  roots.forEach(walk);
}

function finalizeBranchSiblingLayout(
  positioned: Map<number, PositionedMember>,
  roots: LayoutTreeNode[],
  childrenByParent: Map<number, FamilyMemberInput[]>,
  childCountById: Map<number, number>,
  gap: number,
): void {
  const depthById = buildMemberDepthById(roots);
  relayoutParentChildrenGroups(positioned, childrenByParent, childCountById, depthById, gap);
  enforceSiblingGroupSpacing(positioned, childrenByParent, childCountById, gap);
  relayoutParentChildrenGroups(positioned, childrenByParent, childCountById, depthById, gap);
  enforceSiblingGroupSpacing(positioned, childrenByParent, childCountById, gap);
  realignParentsOverChildrenInMap(positioned, roots, childrenByParent, childCountById);
}

function mergeBranchBlockPositions(
  block: { positioned: Map<number, PositionedMember> },
  offsetX: number,
  offsetY: number,
  target: Map<number, PositionedMember>,
): void {
  block.positioned.forEach((pos, id) => {
    target.set(id, {
      ...pos,
      x: Math.round(pos.x + offsetX),
      y: Math.round(pos.y + offsetY),
    });
  });
}

/** Horizontal block: parent on the left, children spread in rows to the right. */
function layoutMemberBlockHorizontal(
  member: FamilyMemberInput,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  depth: number,
  maxDepth: number,
  gap: number,
  maxCardsPerRow: number,
): {
  width: number;
  height: number;
  positioned: Map<number, PositionedMember>;
} {
  const positioned = new Map<number, PositionedMember>();
  const cardW = FLOW_MEMBER_CARD.width;
  const cardH = FLOW_MEMBER_CARD.height;
  const children = depth < maxDepth ? (childrenByParent.get(member.id) ?? []) : [];

  if (children.length === 0) {
    positioned.set(member.id, toPositionedMember(member, 0, 0));
    return { width: cardW, height: cardH, positioned };
  }

  const nextDepth = depth + 1;
  const childHasDescendants = children.some(
    (child) => nextDepth < maxDepth && (childrenByParent.get(child.id)?.length ?? 0) > 0,
  );
  const childX = cardW + BRANCH_DEPTH_GAP;

  if (!childHasDescendants) {
    const childRows = wrapMemberInputsIntoRows(children, maxCardsPerRow);
    const rowWidths = childRows.map((row) => rowPixelWidth(row.length, gap));
    const childBlockWidth = Math.max(...rowWidths, cardW);
    const childBlockHeight = childRows.length > 0
      ? childRows.length * cardH + (childRows.length - 1) * gap
      : 0;
    const blockWidth = childX + childBlockWidth;
    const blockHeight = Math.max(cardH, childBlockHeight);

    positioned.set(member.id, toPositionedMember(member, 0, blockHeight / 2 - cardH / 2));

    childRows.forEach((row, rowIndex) => {
      const rowWidth = rowPixelWidth(row.length, gap);
      const rowLeft = childX;
      const xsById = rtlXsById(row, rowLeft, gap, () => cardW);
      const y = (blockHeight - childBlockHeight) / 2 + rowIndex * (cardH + gap);

      row.forEach((child) => {
        positioned.set(child.id, toPositionedMember(child, xsById.get(child.id) ?? rowLeft, y));
      });
    });

    return { width: blockWidth, height: blockHeight, positioned };
  }

  const columnGap = gap + BRANCH_COLUMN_GAP_EXTRA;
  const childBlocks = children.map((child) =>
    layoutMemberBlockHorizontal(child, childrenByParent, nextDepth, maxDepth, gap, maxCardsPerRow),
  );
  const totalChildWidth = childBlocks.reduce(
    (sum, block, index) => sum + block.width + (index > 0 ? columnGap : 0),
    0,
  );
  const maxChildHeight = Math.max(...childBlocks.map((block) => block.height), cardH);
  const blockWidth = childX + totalChildWidth;
  const blockHeight = Math.max(cardH, maxChildHeight);

  positioned.set(member.id, toPositionedMember(member, 0, blockHeight / 2 - cardH / 2));

  const blockXs = computeRtlRowXs(
    childX,
    childBlocks.map((block) => block.width),
    columnGap,
  );

  childBlocks.forEach((block, index) => {
    const blockX = blockXs[index] ?? childX;
    const blockYOffset = (blockHeight - block.height) / 2;
    block.positioned.forEach((pos, id) => {
      positioned.set(id, {
        ...pos,
        x: Math.round(pos.x + blockX),
        y: Math.round(pos.y + blockYOffset),
      });
    });
  });

  return { width: blockWidth, height: blockHeight, positioned };
}

function layoutBranchFamilyMapHorizontal(
  members: FamilyMemberInput[],
  roots: LayoutTreeNode[],
  maxDepth: number,
  maxRowWidth = MAX_TREE_BRANCH_WIDTH,
): Map<number, PositionedMember> {
  const positioned = new Map<number, PositionedMember>();
  const root = roots[0];
  if (!root) return positioned;

  const founder = resolveBranchMapFounder(members, root);
  if (!founder) return positioned;

  const childrenByParent = buildDirectChildrenMap(members);
  const gen2Parents = childrenByParent.get(founder.id) ?? [];
  const gap = FLOW_MIN_GAP;
  const columnGap = gap + BRANCH_COLUMN_GAP_EXTRA;
  const rowGap = gap + BRANCH_ROW_GAP;

  const gen2Blocks = gen2Parents.map((parent) =>
    layoutMemberBlockHorizontal(parent, childrenByParent, 2, maxDepth, gap, BRANCH_CHILDREN_PER_ROW),
  );

  const founderW = FLOW_FOUNDER_CARD.width;
  const founderH = FLOW_FOUNDER_CARD.height;
  const gen2AreaWidth = Math.max(
    480,
    maxRowWidth - founderW - BRANCH_DEPTH_GAP - BRANCH_LEFT_PADDING * 2,
  );

  type RowBand = { blocks: typeof gen2Blocks; width: number; maxHeight: number };
  const bands: RowBand[] = [];
  let currentBand: RowBand = { blocks: [], width: 0, maxHeight: 0 };

  gen2Blocks.forEach((block) => {
    const extra = currentBand.blocks.length > 0 ? columnGap : 0;
    const nextWidth = currentBand.width + extra + block.width;

    if (nextWidth > gen2AreaWidth && currentBand.blocks.length > 0) {
      bands.push(currentBand);
      currentBand = { blocks: [block], width: block.width, maxHeight: block.height };
      return;
    }

    currentBand.blocks.push(block);
    currentBand.width = nextWidth;
    currentBand.maxHeight = Math.max(currentBand.maxHeight, block.height);
  });

  if (currentBand.blocks.length > 0) bands.push(currentBand);

  const totalBandsHeight = bands.reduce(
    (sum, band, index) => sum + band.maxHeight + (index > 0 ? rowGap : 0),
    0,
  );
  const contentHeight = Math.max(founderH, totalBandsHeight);
  const founderY = BRANCH_LEFT_PADDING + contentHeight / 2 - founderH / 2;

  positioned.set(
    founder.id,
    toPositionedMember(founder, BRANCH_LEFT_PADDING, founderY),
  );

  const gen2X = BRANCH_LEFT_PADDING + founderW + BRANCH_DEPTH_GAP;
  let bandY = BRANCH_LEFT_PADDING + (contentHeight - totalBandsHeight) / 2;

  bands.forEach((band) => {
    const blockXs = computeRtlRowXs(
      gen2X,
      band.blocks.map((block) => block.width),
      columnGap,
    );

    band.blocks.forEach((block, index) => {
      const blockX = blockXs[index] ?? gen2X;
      const blockYOffset = (band.maxHeight - block.height) / 2;
      block.positioned.forEach((pos, id) => {
        positioned.set(id, {
          ...pos,
          x: Math.round(pos.x + blockX),
          y: Math.round(pos.y + bandY + blockYOffset),
        });
      });
    });

    bandY += band.maxHeight + rowGap;
  });

  return positioned;
}

function normalizeLayoutOrigin(
  positionedById: Map<number, PositionedMember>,
  padding = BRANCH_LEFT_PADDING,
): Map<number, PositionedMember> {
  const members = [...positionedById.values()];
  if (members.length === 0) return positionedById;

  const minX = Math.min(...members.map((member) => member.x));
  const minY = Math.min(...members.map((member) => member.y));
  const normalized = new Map<number, PositionedMember>();

  positionedById.forEach((member, id) => {
    normalized.set(id, {
      ...member,
      x: Math.round(member.x - minX + padding),
      y: Math.round(member.y - minY + padding),
    });
  });

  return normalized;
}

function computeCardsPerRowForWidth(
  availableWidth: number,
  gap: number = FLOW_MIN_GAP,
): number {
  const cardW = FLOW_MEMBER_CARD.width;
  return Math.max(1, Math.floor((availableWidth + gap) / (cardW + gap)));
}

/** Lay out direct children (and descendants) inside a horizontal sector. */
function layoutChildrenInSector(
  member: FamilyMemberInput,
  childrenByParent: Map<number, FamilyMemberInput[]>,
  depth: number,
  maxDepth: number,
  sectorX: number,
  sectorWidth: number,
  startY: number,
  gap: number,
  positioned: Map<number, PositionedMember>,
): void {
  const cardW = FLOW_MEMBER_CARD.width;
  const cardH = FLOW_MEMBER_CARD.height;
  const children = depth < maxDepth ? (childrenByParent.get(member.id) ?? []) : [];
  if (children.length === 0) return;

  const cardsPerRow = computeCardsPerRowForWidth(sectorWidth, gap);
  const childHasDescendants = children.some(
    (child) => (depth + 1) < maxDepth && (childrenByParent.get(child.id)?.length ?? 0) > 0,
  );

  if (!childHasDescendants) {
    const rows = wrapMemberInputsIntoRows(children, cardsPerRow);
    let y = startY;

    rows.forEach((row) => {
      const rowWidth = rowPixelWidth(row.length, gap);
      const rowLeft = sectorX + Math.max(0, (sectorWidth - rowWidth) / 2);
      const xsById = rtlXsById(row, rowLeft, gap, () => cardW);

      row.forEach((child) => {
        positioned.set(child.id, toPositionedMember(child, xsById.get(child.id) ?? rowLeft, y));
      });

      y += cardH + gap;
    });
    return;
  }

  const childSectorWidth = sectorWidth / children.length;
  const sectorXs = computeRtlRowXs(
    sectorX,
    children.map(() => childSectorWidth),
    0,
  );

  children.forEach((child, index) => {
    const childSectorX = sectorXs[index] ?? sectorX;
    const childX = childSectorX + Math.max(0, childSectorWidth / 2 - cardW / 2);
    positioned.set(child.id, toPositionedMember(child, childX, startY));

    layoutChildrenInSector(
      child,
      childrenByParent,
      depth + 1,
      maxDepth,
      childSectorX,
      childSectorWidth,
      startY + cardH + BRANCH_DEPTH_GAP,
      gap,
      positioned,
    );
  });
}

type SectorAnchor = {
  member: FamilyMemberInput;
  centerX: number;
  rowIndex: number;
};

function buildSectorBounds(
  anchors: SectorAnchor[],
  anchorIndex: number,
  maxRowWidth: number,
): { sectorX: number; sectorWidth: number } {
  const anchor = anchors[anchorIndex];
  const sameRow = anchors.filter((item) => item.rowIndex === anchor.rowIndex);
  const indexInRow = sameRow.findIndex((item) => item.member.id === anchor.member.id);

  const prev = indexInRow > 0 ? sameRow[indexInRow - 1] : null;
  const next = indexInRow < sameRow.length - 1 ? sameRow[indexInRow + 1] : null;

  const left = prev ? (prev.centerX + anchor.centerX) / 2 : 0;
  const right = next ? (anchor.centerX + next.centerX) / 2 : maxRowWidth;

  return {
    sectorX: left,
    sectorWidth: Math.max(FLOW_MEMBER_CARD.width + FLOW_MIN_GAP, right - left),
  };
}

/** Top-down branch map that spreads each generation across the full canvas width. */
function layoutBranchFamilyMapWide(
  members: FamilyMemberInput[],
  roots: LayoutTreeNode[],
  maxDepth: number,
  maxRowWidth = MAX_TREE_BRANCH_WIDTH,
): Map<number, PositionedMember> {
  const positioned = new Map<number, PositionedMember>();
  const root = roots[0];
  if (!root) return positioned;

  const founder = resolveBranchMapFounder(members, root);
  if (!founder) return positioned;

  const childrenByParent = buildDirectChildrenMap(members);
  const gen2Parents = childrenByParent.get(founder.id) ?? [];
  const gap = FLOW_MIN_GAP;
  const cardW = FLOW_MEMBER_CARD.width;
  const cardH = FLOW_MEMBER_CARD.height;
  const founderW = FLOW_BRANCH_MAP_ROOT_CARD.width;
  const founderH = FLOW_BRANCH_MAP_ROOT_CARD.height;

  positioned.set(
    founder.id,
    toPositionedMember(
      founder,
      maxRowWidth / 2 - founderW / 2,
      BRANCH_TOP_PADDING,
    ),
  );

  if (gen2Parents.length === 0) return positioned;

  const cardsPerRow = computeCardsPerRowForWidth(maxRowWidth, gap);
  const gen2Rows = wrapMemberInputsIntoRows(gen2Parents, cardsPerRow);
  const anchors: SectorAnchor[] = [];
  let gen2Y = BRANCH_TOP_PADDING + founderH + BRANCH_DEPTH_GAP;

  gen2Rows.forEach((row, rowIndex) => {
    const rowWidth = rowPixelWidth(row.length, gap);
    const slack = Math.max(0, maxRowWidth - rowWidth);
    const distGap = row.length > 1
      ? gap + slack / (row.length - 1)
      : 0;
    const rowLeft = row.length === 1 ? (maxRowWidth - cardW) / 2 : 0;
    const xsById = rtlXsById(row, rowLeft, distGap, () => cardW);

    row.forEach((member) => {
      positioned.set(member.id, toPositionedMember(member, xsById.get(member.id) ?? rowLeft, gen2Y));
      anchors.push({
        member,
        centerX: (xsById.get(member.id) ?? rowLeft) + cardW / 2,
        rowIndex,
      });
    });

    gen2Y += cardH + gap;
  });

  anchors.forEach((anchor, anchorIndex) => {
    const { sectorX, sectorWidth } = buildSectorBounds(anchors, anchorIndex, maxRowWidth);
    const parentY = positioned.get(anchor.member.id)?.y ?? gen2Y;

    layoutChildrenInSector(
      anchor.member,
      childrenByParent,
      2,
      maxDepth,
      sectorX,
      sectorWidth,
      parentY + cardH + BRANCH_DEPTH_GAP,
      gap,
      positioned,
    );
  });

  return positioned;
}

/**
 * Vertical-first genealogy map:
 * founder on top → gen-2 in one or two balanced rows → each branch subtree stacks below its head.
 */
function layoutBranchFamilyMap(
  members: FamilyMemberInput[],
  roots: LayoutTreeNode[],
  maxDepth: number,
  maxRowWidth = MAX_TREE_BRANCH_WIDTH,
): Map<number, PositionedMember> {
  const positioned = new Map<number, PositionedMember>();
  const root = roots[0];
  if (!root) return positioned;

  const founder = resolveBranchMapFounder(members, root);
  if (!founder) return positioned;

  const childrenByParent = buildDirectChildrenMap(members);
  const childCountById = buildChildCountById(childrenByParent);
  const branchRoots = childrenByParent.get(founder.id) ?? [];
  const branchRootByMemberId = buildBranchRootByMemberId(roots);
  const depthById = buildMemberDepthById(roots);
  const gap = BRANCH_MAP_SIBLING_GAP;
  const founderW = FLOW_BRANCH_MAP_ROOT_CARD.width;
  const founderH = FLOW_BRANCH_MAP_ROOT_CARD.height;
  const columnGap = gap + BRANCH_COLUMN_GAP_EXTRA;
  const founderDepth = depthById.get(founder.id) ?? 1;
  const branchStartDepth = founderDepth + 1;

  const place = (member: FamilyMemberInput, x: number, y: number): void => {
    positioned.set(
      member.id,
      toPositionedMember(member, x, y, branchRootByMemberId),
    );
  };

  if (branchRoots.length === 0) {
    place(founder, BRANCH_LEFT_PADDING, BRANCH_TOP_PADDING);
    return positioned;
  }

  const columns = branchRoots.map((branchRoot) => {
    const block = layoutMemberBlock(
      branchRoot,
      childrenByParent,
      branchStartDepth,
      maxDepth,
      gap,
      BRANCH_CHILDREN_PER_ROW,
      childCountById,
      branchRootByMemberId,
    );
    return {
      block,
      ...splitBranchBlockHeadAndDescendants(block, branchRoot.id),
      branchRoot,
    };
  });

  const useMultiGen2Rows = shouldWrapGen2BranchHeadRows(columns.length);
  const gen2Rows = useMultiGen2Rows
    ? wrapGen2ColumnsIntoRows(columns, GEN2_BRANCH_HEADS_PER_ROW)
    : [columns];

  const rowWidths = gen2Rows.map((row) => sumRowWidth(row, columnGap));
  const totalLayoutWidth = Math.max(founderW, ...rowWidths);

  place(
    founder,
    Math.max(BRANCH_LEFT_PADDING, totalLayoutWidth / 2 - founderW / 2),
    BRANCH_TOP_PADDING,
  );

  const topGen2Y = BRANCH_TOP_PADDING + founderH + BRANCH_DEPTH_GAP;

  if (!useMultiGen2Rows) {
    const rowLeft = Math.max(0, (totalLayoutWidth - rowWidths[0]) / 2);
    const columnXs = computeRtlRowXs(
      rowLeft,
      columns.map((column) => column.block.width),
      columnGap,
    );
    columns.forEach((column, index) => {
      mergeBranchBlockPositions(column.block, columnXs[index] ?? rowLeft, topGen2Y, positioned);
    });
  } else {
    let rowY = topGen2Y;

    gen2Rows.forEach((row) => {
      const rowWidth = sumRowWidth(row, columnGap);
      const rowLeft = Math.max(0, (totalLayoutWidth - rowWidth) / 2);
      const columnXs = computeRtlRowXs(
        rowLeft,
        row.map((column) => column.width),
        columnGap,
      );
      const descendantsY = rowY + FLOW_MEMBER_CARD.height + BRANCH_DEPTH_GAP;

      row.forEach((column, index) => {
        const columnX = columnXs[index] ?? rowLeft;
        place(column.branchRoot, columnX + column.headOffsetX, rowY);
        column.descendants.forEach((pos, id) => {
          positioned.set(id, {
            ...pos,
            x: Math.round(pos.x + columnX),
            y: Math.round(pos.y + descendantsY),
          });
        });
      });

      rowY += measureGen2RowSpan(row, rowY) + GEN2_SIBLING_ROW_GAP;
    });
  }

  enforceSiblingGroupSpacing(positioned, childrenByParent, childCountById, gap);
  realignParentsOverChildrenInMap(positioned, roots, childrenByParent, childCountById);
  enforceSiblingGroupSpacing(positioned, childrenByParent, childCountById, gap);

  return positioned;
}

function buildMemberDepthById(roots: LayoutTreeNode[]): Map<number, number> {
  const depthById = new Map<number, number>();
  const walk = (node: LayoutTreeNode, depth: number): void => {
    if (node.id >= 0) depthById.set(node.id, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 1));
  return depthById;
}

function getBranchMapGenerationClass(
  member: FamilyMemberInput,
  depthById: Map<number, number>,
): string {
  const depth = depthById.get(member.id) ?? member.generation;
  return getGenerationThemeClass(Math.min(Math.max(depth, 1), 8));
}

function resolveBranchMapFounder(
  members: FamilyMemberInput[],
  root: LayoutTreeNode,
): FamilyMemberInput | null {
  return members.find((member) => member.id === root.id) ?? null;
}

function isBranchMapRoot(
  member: FamilyMemberInput,
  depthById: Map<number, number> | null,
): boolean {
  if (!depthById) return isFounderMember(member);
  return (depthById.get(member.id) ?? member.generation) === 1;
}

const FLOW_LAYOUT_CACHE_VERSION = 28;

function getBaseLayoutPositions(
  baseMembers: FamilyMemberInput[],
  compactVertical = false,
): Map<number, PositionedMember> {
  const signature = `${FLOW_LAYOUT_CACHE_VERSION}:${compactVertical ? 'compact' : 'full'}:${baseMembers.map((member) => member.id).sort((a, b) => a - b).join(',')}`;
  if (cachedBaseLayout?.signature === signature) {
    return cachedBaseLayout.positioned;
  }

  const roots = buildFamilyHierarchy(baseMembers);
  const branchRootIds = new Set((roots[0]?.children ?? []).map((branch) => branch.id));
  const maxGeneration = maxGenerationFromMembers(baseMembers);
  const stage = computeFlowLayoutStage(baseMembers.length, maxGeneration, compactVertical);
  const layoutResult = computeDynamicTreeLayout(baseMembers, stage);
  let strengthened = strengthenBaseLayoutForFlowCards(
    layoutResult.members,
    roots,
    branchRootIds,
  );
  strengthened = wrapMembersWithinMaxWidth(strengthened, MAX_TREE_BRANCH_WIDTH, FLOW_MIN_GAP);
  strengthened = centerMembersInMaxWidth(strengthened, MAX_TREE_BRANCH_WIDTH);
  const positioned = new Map(strengthened.map((member) => [member.id, member]));

  cachedBaseLayout = { signature, positioned };
  return positioned;
}

function layoutGen5ChildPositions(
  parent: PositionedMember,
  children: FamilyMemberInput[],
): Array<{ member: FamilyMemberInput; x: number; y: number; row: number; col: number }> {
  const rows = chunkMembers(children, MAX_GEN5_PER_ROW);
  const parentSize = flowCardDimensions(parent);
  const parentCenterX = parent.x + parentSize.width / 2;
  let currentY = parent.y - GEN5_ICON_GAP - GEN5_ICON_SIZE - GEN5_ROW_GAP;
  const positions: Array<{ member: FamilyMemberInput; x: number; y: number; row: number; col: number }> = [];

  rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * GEN5_NODE_WIDTH + Math.max(0, row.length - 1) * GEN5_GAP_X;
    const rowLeft = parentCenterX - rowWidth / 2;
    const xsById = rtlXsById(row, rowLeft, GEN5_GAP_X, () => GEN5_NODE_WIDTH);

    row.forEach((member, colIndex) => {
      positions.push({
        member,
        x: xsById.get(member.id) ?? rowLeft,
        y: currentY,
        row: rowIndex,
        col: colIndex,
      });
    });

    currentY -= GEN5_NODE_HEIGHT + GEN5_ROW_GAP;
  });

  return positions;
}

export function buildFamilyTreeFlowLayout(
  members: FamilyMemberInput[],
  selectedId: number | null,
  highlightIds: number[],
  options?: FamilyTreeLayoutOptions,
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  if (members.length === 0) {
    return { nodes: [], edges: [] };
  }

  try {
    return layoutWithBranchZones(members, selectedId, highlightIds, options);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.error('[FamilyTreeFlow] branch layout failed', error);
    }
    return { nodes: [], edges: [] };
  }
}

function layoutWithBranchZones(
  members: FamilyMemberInput[],
  selectedId: number | null,
  highlightIds: number[],
  options?: FamilyTreeLayoutOptions,
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const allMembers = options?.allMembers ?? members;
  const expandedGen5ParentIds = options?.expandedGen5ParentIds ?? new Set<number>();
  const currentZoom = options?.currentZoom ?? 1;
  const gen5AnimatingParentIds = options?.gen5AnimatingParentIds ?? new Set<number>();
  const gen5ClosingParentIds = options?.gen5ClosingParentIds ?? new Set<number>();
  const showAllGenerations = options?.showAllGenerations ?? false;
  const thinEdges = options?.thinEdges ?? false;
  const topDown = options?.topDown ?? false;
  const compactVertical = options?.compactVertical ?? false;
  const branchHorizontalLayout = options?.branchHorizontalLayout ?? false;
  const mainEdgeStyle = buildMainEdgeStyle(thinEdges);

  const baseMembers = (() => {
    if (showAllGenerations) return allMembers;
    if (options?.maxVisibleGenerations != null) {
      const baseline = getGenerationBaseline(allMembers);
      return allMembers.filter(
        (member) => getDisplayGeneration(member, baseline) <= options.maxVisibleGenerations!,
      );
    }
    return filterBaseGenerationMembers(allMembers);
  })();
  const roots = buildFamilyHierarchy(baseMembers);
  const maxVisibleGenerations = options?.maxVisibleGenerations ?? 0;
  const useBranchFamilyLayout = compactVertical && maxVisibleGenerations >= 3;
  const inlineDeepGenerations = showAllGenerations
    || maxVisibleGenerations > DEFAULT_MAX_BASE_GENERATIONS;
  const generationBaseline = getGenerationBaseline(allMembers);
  const branchDepthById = useBranchFamilyLayout ? buildMemberDepthById(roots) : null;
  const layoutMaxWidth = Math.max(
    640,
    options?.layoutMaxWidth ?? MAX_TREE_BRANCH_WIDTH,
  );

  let positionedById: Map<number, PositionedMember>;
  const childrenByParentForLayout = useBranchFamilyLayout
    ? buildDirectChildrenMap(baseMembers)
    : null;
  const layoutChildCountById = childrenByParentForLayout
    ? buildChildCountById(childrenByParentForLayout)
    : null;

  if (useBranchFamilyLayout) {
    if (branchHorizontalLayout) {
      positionedById = layoutBranchFamilyMapHorizontal(
        baseMembers,
        roots,
        maxVisibleGenerations,
        layoutMaxWidth,
      );
      positionedById = normalizeLayoutOrigin(positionedById);
    } else {
      positionedById = layoutBranchFamilyMap(
        baseMembers,
        roots,
        maxVisibleGenerations,
        layoutMaxWidth,
      );
      positionedById = normalizeLayoutOrigin(positionedById);
      if (childrenByParentForLayout && layoutChildCountById) {
        finalizeBranchSiblingLayout(
          positionedById,
          roots,
          childrenByParentForLayout,
          layoutChildCountById,
          BRANCH_MAP_SIBLING_GAP,
        );
      }
      positionedById = resolveBranchMapCollisions(positionedById, roots, layoutMaxWidth);
      if (childrenByParentForLayout && layoutChildCountById) {
        enforceSiblingGroupSpacing(
          positionedById,
          childrenByParentForLayout,
          layoutChildCountById,
          BRANCH_MAP_SIBLING_GAP,
        );
        realignParentsOverChildrenInMap(
          positionedById,
          roots,
          childrenByParentForLayout,
          layoutChildCountById,
        );
        enforceSiblingGroupSpacing(
          positionedById,
          childrenByParentForLayout,
          layoutChildCountById,
          BRANCH_MAP_SIBLING_GAP,
        );
      }
    }
  } else {
    positionedById = getBaseLayoutPositions(baseMembers, compactVertical);
    if (topDown) {
      positionedById = flipPositionsTopDown(positionedById);
    }
    if (compactVertical) {
      positionedById = compactVerticalByDepth(positionedById, roots);
      positionedById = resolveBranchMapCollisions(positionedById, roots);
    }
  }
  const gen4ParentsWithGen5 = showAllGenerations
    ? new Map<number, FamilyMemberInput[]>()
    : getGen4ParentsWithGen5Children(allMembers);
  const gen5ParentByChildId = new Map<number, number>();
  const gen5ChildrenByParent = new Map<number, number[]>();
  gen4ParentsWithGen5.forEach((children, parentId) => {
    gen5ChildrenByParent.set(parentId, children.map((child) => child.id));
    children.forEach((child) => gen5ParentByChildId.set(child.id, parentId));
  });

  const childCountById = new Map<number, number>();
  const countMembers = options?.childCountMembers ?? allMembers;
  countMembers.forEach((member) => {
    const parentId = resolvePrimaryTreeParentId(member);
    if (parentId == null) return;
    childCountById.set(parentId, (childCountById.get(parentId) ?? 0) + 1);
  });

  const nodes: Node<FlowNodeData>[] = baseMembers.map((member) => {
    const positioned = positionedById.get(member.id);
    const childCount = useBranchFamilyLayout && childrenByParentForLayout
      ? (childrenByParentForLayout.get(member.id)?.length ?? 0)
      : (childCountById.get(member.id) ?? 0);
    const directGen5Count = getDirectGen5Children(member.id, allMembers).length;
    const branchRoot = isBranchMapRoot(member, branchDepthById);
    const size = nodeSize(member, childCount);
    const useFounderCard = branchRoot || (!useBranchFamilyLayout && isFounderMember(member));
    const founderCard = branchRoot ? FLOW_BRANCH_MAP_ROOT_CARD : FLOW_FOUNDER_CARD;

    const branchDepth = branchDepthById?.get(member.id);
    const isGen3BranchMember = branchDepth === 3;

    return {
      id: String(member.id),
      type: 'familyMember',
      position: {
        x: positioned?.x ?? 0,
        y: positioned?.y ?? 0,
      },
      data: {
        memberId: member.id,
        fullName: member.fullName,
        displayName: size.displayName,
        initial: member.initial,
        photoUrl: member.photoUrl ?? null,
        childCount,
        hiddenChildCount: inlineDeepGenerations ? 0 : directGen5Count,
        isExpandable: useBranchFamilyLayout && !branchRoot && (childCount > 0 || isGen3BranchMember),
        generation: member.generation,
        generationClass: useBranchFamilyLayout && branchDepthById
          ? getBranchMapGenerationClass(member, branchDepthById)
          : getGenerationThemeClass(member.generation),
        isFounder: useFounderCard,
        isSelected: selectedId === member.id,
        isHighlighted: highlightIds.includes(member.id),
        inSelectedPath: false,
        horizontalLayout: useBranchFamilyLayout && branchHorizontalLayout,
      },
      draggable: false,
      selectable: false,
      width: useFounderCard ? founderCard.width : size.width,
      height: useFounderCard ? founderCard.height : size.height,
      zIndex: 10,
    };
  });

  const edges: Edge[] = [];
  const branchMapRootId = useBranchFamilyLayout ? (roots[0]?.id ?? null) : null;
  const branchEdgeDataById = thinEdges
    ? buildBranchFamilyEdgeMetadata(baseMembers, positionedById, branchMapRootId)
    : new Map<string, BranchFamilyEdgeData>();

  baseMembers.forEach((member) => {
    const parentId = resolvePrimaryTreeParentId(member);
    if (parentId == null || !positionedById.has(parentId)) return;

    const edgeId = buildFamilyTreeEdgeId(parentId, member.id);
    edges.push({
      id: edgeId,
      source: String(parentId),
      target: String(member.id),
      sourceHandle: 'children',
      targetHandle: 'parent',
      type: thinEdges ? 'branchFamily' : 'smoothstep',
      className: thinEdges ? 'branch-family-edge-link' : undefined,
      data: branchEdgeDataById.get(edgeId),
    });
  });

  if (!inlineDeepGenerations) gen4ParentsWithGen5.forEach((gen5Children, parentId) => {
    const parent = positionedById.get(parentId);
    if (!parent) return;

    const parentSize = flowCardDimensions(parent);
    const parentCenterX = parent.x + parentSize.width / 2;
    const showCards = shouldShowGen5Cards(parentId, expandedGen5ParentIds, currentZoom);
    const showIcon = shouldShowGen5Icon(parentId, gen5Children.length, expandedGen5ParentIds, currentZoom);

    if (showIcon) {
      const x = parentCenterX - GEN5_ICON_SIZE / 2;
      const y = parent.y - GEN5_ICON_GAP - GEN5_ICON_SIZE;

      nodes.push({
        id: gen5IconNodeId(parentId),
        type: 'gen5Icon',
        position: { x, y },
        data: {
          parentMemberId: parentId,
          childCount: gen5Children.length,
          isExpanded: expandedGen5ParentIds.has(parentId),
        },
        draggable: false,
        selectable: false,
        width: GEN5_ICON_SIZE,
        height: GEN5_ICON_SIZE,
        zIndex: 9,
      });

      edges.push({
        id: buildFamilyTreeEdgeId(parentId, gen5IconNodeId(parentId)),
        source: String(parentId),
        target: gen5IconNodeId(parentId),
        sourceHandle: 'gen5',
        targetHandle: 'parent',
        type: 'smoothstep',
        className: 'gen5-link',
        style: {
          stroke: '#8a6d3b',
          strokeWidth: 0.8,
          opacity: 0.35,
        },
      });
    }

    if (showCards) {
      const childPositions = layoutGen5ChildPositions(parent, gen5Children);
      const isEntering = gen5AnimatingParentIds.has(parentId);
      const isExiting = gen5ClosingParentIds.has(parentId);

      childPositions.forEach(({ member, x, y, row, col }) => {
        const animationDelayMs = (row * MAX_GEN5_PER_ROW + col) * 40;

        nodes.push({
          id: String(member.id),
          type: 'gen5Member',
          position: { x, y },
          data: {
            memberId: member.id,
            fullName: member.fullName,
            displayName: getMemberFirstName(member.fullName),
            isEntering: isEntering && !isExiting,
            isExiting,
            animationDelayMs,
          },
          draggable: false,
          selectable: false,
          width: GEN5_NODE_WIDTH,
          height: GEN5_NODE_HEIGHT,
          zIndex: 9,
        });

        edges.push({
          id: buildFamilyTreeEdgeId(parentId, member.id),
          source: String(parentId),
          target: String(member.id),
          sourceHandle: 'gen5',
          targetHandle: 'parent',
          type: 'smoothstep',
          className: `gen5-link${isEntering ? ' is-entering' : ''}${isExiting ? ' is-exiting' : ''}`,
          style: {
            stroke: '#8a6d3b',
            strokeWidth: 0.8,
            opacity: 0.35,
          },
          data: {
            animationDelayMs,
          },
        });
      });
    }
  });

  const { nodes: resolvedNodes } = finalizeFlowLayout(nodes, edges, {
    positionedById,
    roots,
    gen5ParentByChildId,
    gen5ChildrenByParent,
  });

  return { nodes: resolvedNodes, edges };
}

export function invalidateBaseTreeLayoutCache(): void {
  cachedBaseLayout = null;
}

/** Spread positions used by reference tree — reuse for full branch forest maps. */
export function getSpreadTreeLayoutPositions(
  allMembers: FamilyMemberInput[],
): {
  baseMembers: FamilyMemberInput[];
  positionedById: Map<number, PositionedMember>;
} {
  const baseMembers = filterBaseGenerationMembers(allMembers);
  const positionedById = getBaseLayoutPositions(baseMembers);
  return { baseMembers, positionedById };
}
