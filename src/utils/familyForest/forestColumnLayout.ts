import {
  getDirectGen5Children,
  DEFAULT_MAX_BASE_GENERATIONS,
} from '../gen5Expansion';
import {
  getDisplayGeneration,
  getGenerationBaseline,
} from '../progressiveTreeDisclosure';
import { buildFamilyHierarchy } from '../treeLayout/buildFamilyHierarchy';
import { computeRtlRowXs, sortSiblingsByAddOrder } from '../treeLayout/siblingOrder';
import type { FamilyMemberInput, LayoutTreeNode } from '../treeLayout/types';
import { getForestPanelColor } from './branchColors';
import {
  getCardSizeForTier,
  getForestColumnWidth,
  getGen3GridCardSize,
  FOREST_INITIAL_DESCENDANTS_PER_BRANCH,
  FOREST_INITIAL_GRID_COLUMNS,
  type ForestCardTier,
  type ForestViewportSpec,
} from './forestViewport';

export interface ForestPlacedItem {
  memberId: number;
  parentId: number | null;
  branchIndex: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'card' | 'expand-icon' | 'inline';
  cardTier: ForestCardTier;
  branchMemberCount?: number;
  childCount?: number;
  isExpanded?: boolean;
  isGen3Grid?: boolean;
}

export interface ForestBranchPanel {
  columnIndex: number;
  branchIndex: number | null;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  memberCount: number;
  branchName?: string;
}

export interface ForestFounderRail {
  top: number;
  height: number;
  founderStemHeight: number;
  founderBottom: { x: number; y: number };
  branchTops: Array<{ x: number; y: number }>;
}

export interface ForestColumnLayoutResult {
  items: ForestPlacedItem[];
  branchByMemberId: Map<number, number>;
  panels: ForestBranchPanel[];
  founderRail: ForestFounderRail | null;
  height: number;
}

const MAX_CHILD_ROWS = 3;
const GEN2_ROW_GAP = 20;

function getBranchContentTop(
  branchHeadY: number,
  branchHeadHeight: number,
  generationGap: number,
): number {
  return branchHeadY + branchHeadHeight + generationGap;
}

function visibleChildren(node: LayoutTreeNode): LayoutTreeNode[] {
  return sortSiblingsByAddOrder(
    node.children.filter((child) => child.id >= 0),
  );
}

function tagBranch(branch: LayoutTreeNode, branchIndex: number, map: Map<number, number>): void {
  const walk = (node: LayoutTreeNode): void => {
    map.set(node.id, branchIndex);
    visibleChildren(node).forEach(walk);
  };
  walk(branch);
}

function countSubtree(node: LayoutTreeNode): number {
  let total = 1;
  visibleChildren(node).forEach((child) => {
    total += countSubtree(child);
  });
  return total;
}

/** Direct children of the founder — gen-2 branch heads. */
export function countGen2Branches(members: FamilyMemberInput[]): number {
  const roots = buildFamilyHierarchy(members);
  if (roots.length === 0) return 1;
  const branches = visibleChildren(roots[0]);
  return Math.max(1, branches.length);
}

function isWithinBaseGenerations(
  node: LayoutTreeNode,
  baseline: number,
): boolean {
  return getDisplayGeneration(
    { ...node, generation: node.generation },
    baseline,
  ) <= DEFAULT_MAX_BASE_GENERATIONS;
}

function resolveRowOverlaps(
  placements: Array<{ memberId: number; x: number; width: number }>,
  columnLeft: number,
  columnRight: number,
  minGap: number,
): void {
  if (placements.length <= 1) return;

  placements.sort((left, right) => left.x - right.x);

  for (let index = 1; index < placements.length; index += 1) {
    const prev = placements[index - 1];
    const current = placements[index];
    const minX = prev.x + prev.width + minGap;
    if (current.x < minX) {
      current.x = minX;
    }
  }

  const last = placements[placements.length - 1];
  const overflow = last.x + last.width - columnRight;
  if (overflow > 0) {
    placements.forEach((placement) => {
      placement.x = Math.max(columnLeft, placement.x - overflow);
    });

    for (let index = 1; index < placements.length; index += 1) {
      const prev = placements[index - 1];
      const current = placements[index];
      const minX = prev.x + prev.width + minGap;
      if (current.x < minX) {
        current.x = minX;
      }
    }
  }
}

function placeWrappedChildren(
  children: LayoutTreeNode[],
  parentCenterX: number,
  y: number,
  tier: ForestCardTier,
  columnLeft: number,
  columnWidth: number,
  spec: ForestViewportSpec,
  branchIndex: number,
  columnIndex: number,
  parentId: number,
  items: ForestPlacedItem[],
): number {
  if (children.length === 0) return y;

  const { width: cardWidth, height: cardHeight } = getCardSizeForTier(tier, spec);
  const columnRight = columnLeft + columnWidth;
  const gap = spec.rowGap;
  const maxPerRow = Math.max(
    1,
    Math.min(
      Math.floor((columnWidth + gap) / (cardWidth + gap)),
      Math.ceil(children.length / MAX_CHILD_ROWS),
    ),
  );

  let cursorY = y;

  for (let start = 0; start < children.length; start += maxPerRow) {
    const rowChildren = children.slice(start, start + maxPerRow);
    const rowWidth = rowChildren.length * cardWidth + Math.max(0, rowChildren.length - 1) * gap;
    const rowLeft = parentCenterX - rowWidth / 2;
    const positions = computeRtlRowXs(
      rowLeft,
      rowChildren.map(() => cardWidth),
      gap,
    );

    const placements = rowChildren.map((child, index) => ({
      memberId: child.id,
      node: child,
      x: positions[index],
      width: cardWidth,
    }));

    resolveRowOverlaps(placements, columnLeft, columnRight, gap);

    placements.forEach((placement) => {
      const clampedX = Math.max(columnLeft, Math.min(placement.x, columnRight - cardWidth));
      items.push({
        memberId: placement.node.id,
        parentId,
        branchIndex,
        columnIndex,
        x: Math.round(clampedX),
        y: Math.round(cursorY),
        width: cardWidth,
        height: cardHeight,
        kind: 'card',
        cardTier: tier,
      });
    });

    cursorY += cardHeight + gap;
  }

  return cursorY;
}

function layoutGen5UnderParent(
  parentId: number,
  parentCenterX: number,
  startY: number,
  columnLeft: number,
  columnWidth: number,
  members: FamilyMemberInput[],
  spec: ForestViewportSpec,
  expandedGen5ParentIds: ReadonlySet<number>,
  branchIndex: number,
  columnIndex: number,
  items: ForestPlacedItem[],
): number {
  const gen5Children = getDirectGen5Children(parentId, members);
  if (gen5Children.length === 0) return startY;

  const iconX = parentCenterX - spec.expandIconSize / 2;
  const isExpanded = expandedGen5ParentIds.has(parentId);

  items.push({
    memberId: parentId,
    parentId,
    branchIndex,
    columnIndex,
    x: Math.round(iconX),
    y: Math.round(startY),
    width: spec.expandIconSize,
    height: spec.expandIconSize,
    kind: 'expand-icon',
    cardTier: 'micro',
    childCount: gen5Children.length,
    isExpanded,
  });

  if (!isExpanded) return startY + spec.expandIconSize + spec.rowGap;

  const inlineNodes = gen5Children.map((child) => ({
    id: child.id,
    generation: child.generation,
    fullName: child.fullName,
    fatherId: child.fatherId,
    motherId: child.motherId,
    gender: child.gender,
    initial: child.initial,
    photoUrl: child.photoUrl,
    children: [],
    subtreeWidth: 0,
    x: 0,
    y: 0,
    primaryTreeParentId: parentId,
    mainBranchRootId: null,
  })) as LayoutTreeNode[];

  const { width: cardWidth, height: cardHeight } = getCardSizeForTier('micro', spec);
  const columnRight = columnLeft + columnWidth;
  const gap = spec.rowGap;
  const maxPerRow = Math.max(
    1,
    Math.min(
      Math.floor((columnWidth + gap) / (cardWidth + gap)),
      Math.ceil(inlineNodes.length / MAX_CHILD_ROWS),
    ),
  );

  let cursorY = startY + spec.expandIconSize + spec.rowGap;

  for (let start = 0; start < inlineNodes.length; start += maxPerRow) {
    const rowChildren = inlineNodes.slice(start, start + maxPerRow);
    const rowWidth = rowChildren.length * cardWidth + Math.max(0, rowChildren.length - 1) * gap;
    const rowLeft = parentCenterX - rowWidth / 2;
    const positions = computeRtlRowXs(
      rowLeft,
      rowChildren.map(() => cardWidth),
      gap,
    );

    const placements = rowChildren.map((child, index) => ({
      memberId: child.id,
      node: child,
      x: positions[index],
      width: cardWidth,
    }));

    resolveRowOverlaps(placements, columnLeft, columnRight, gap);

    placements.forEach((placement) => {
      const clampedX = Math.max(columnLeft, Math.min(placement.x, columnRight - cardWidth));
      items.push({
        memberId: placement.node.id,
        parentId,
        branchIndex,
        columnIndex,
        x: Math.round(clampedX),
        y: Math.round(cursorY),
        width: cardWidth,
        height: cardHeight,
        kind: 'inline',
        cardTier: 'micro',
      });
    });

    cursorY += cardHeight + gap;
  }

  return cursorY + spec.rowGap;
}

function getItemCenterX(item: ForestPlacedItem): number {
  return item.x + item.width / 2;
}

function collectGen3BranchChildren(
  branch: LayoutTreeNode,
  limit: number,
): LayoutTreeNode[] {
  return visibleChildren(branch).slice(0, limit);
}

function resolveTreeParentId(node: LayoutTreeNode): number | null {
  return node.fatherId ?? node.motherId ?? node.primaryTreeParentId ?? null;
}

function placeDescendantGrid(
  descendants: LayoutTreeNode[],
  columnLeft: number,
  columnWidth: number,
  startY: number,
  spec: ForestViewportSpec,
  branchIndex: number,
  columnIndex: number,
  items: ForestPlacedItem[],
): number {
  if (descendants.length === 0) return startY;

  const { width: cardWidth, height: cardHeight, gap } = getGen3GridCardSize(columnWidth, spec);
  const innerLeft = columnLeft + spec.panelPadding;
  const innerWidth = columnWidth - spec.panelPadding * 2;
  let cursorY = startY;

  for (let rowStart = 0; rowStart < descendants.length; rowStart += FOREST_INITIAL_GRID_COLUMNS) {
    const rowNodes = descendants.slice(rowStart, rowStart + FOREST_INITIAL_GRID_COLUMNS);
    const rowWidth = rowNodes.length * cardWidth + gap * Math.max(0, rowNodes.length - 1);
    const rowLeft = innerLeft + Math.max(0, (innerWidth - rowWidth) / 2);
    const positions = computeRtlRowXs(
      rowLeft,
      rowNodes.map(() => cardWidth),
      gap,
    );

    rowNodes.forEach((node, index) => {
      items.push({
        memberId: node.id,
        parentId: resolveTreeParentId(node),
        branchIndex,
        columnIndex,
        x: positions[index],
        y: Math.round(cursorY),
        width: cardWidth,
        height: cardHeight,
        kind: 'card',
        cardTier: 'gen3-grid',
        isGen3Grid: true,
      });
    });

    cursorY += cardHeight + gap;
  }

  return cursorY;
}

function layoutBranchColumn(
  branch: LayoutTreeNode,
  branchIndex: number,
  columnIndex: number,
  columnLeft: number,
  columnWidth: number,
  branchHeadY: number,
  rootId: number,
  members: FamilyMemberInput[],
  baseline: number,
  spec: ForestViewportSpec,
  expandedGen5ParentIds: ReadonlySet<number>,
  items: ForestPlacedItem[],
): number {
  const branchHeadSize = getCardSizeForTier('branch-head', spec);
  const branchHeadWidth = Math.max(
    branchHeadSize.width,
    Math.min(columnWidth - 16, Math.round(columnWidth * 0.64)),
  );
  const branchHeadHeight = branchHeadSize.height;
  const branchHeadX = columnLeft + (columnWidth - branchHeadWidth) / 2;

  items.push({
    memberId: branch.id,
    parentId: rootId,
    branchIndex,
    columnIndex,
    x: Math.round(branchHeadX),
    y: Math.round(branchHeadY),
    width: branchHeadWidth,
    height: branchHeadHeight,
    kind: 'card',
    cardTier: 'branch-head',
    branchMemberCount: countSubtree(branch),
  });

  const contentTop = getBranchContentTop(branchHeadY, branchHeadHeight, spec.generationGap);
  const gridStartY = contentTop + spec.panelPadding;
  const descendants = collectGen3BranchChildren(
    branch,
    FOREST_INITIAL_DESCENDANTS_PER_BRANCH,
  );
  const gridBottom = placeDescendantGrid(
    descendants,
    columnLeft,
    columnWidth,
    gridStartY,
    spec,
    branchIndex,
    columnIndex,
    items,
  );

  return gridBottom + spec.branchFooterGap + spec.branchFooterHeight;
}

export function layoutForestColumns(
  members: FamilyMemberInput[],
  spec: ForestViewportSpec,
  expandedGen5ParentIds: ReadonlySet<number>,
  _branchColors: string[],
): ForestColumnLayoutResult {
  const roots = buildFamilyHierarchy(members);
  if (roots.length === 0) {
    return {
      items: [],
      branchByMemberId: new Map(),
      panels: [],
      founderRail: null,
      height: 400,
    };
  }

  const root = roots[0];
  const baseline = getGenerationBaseline(members);
  const columnWidth = getForestColumnWidth(spec);
  const branches = visibleChildren(root);
  const branchByMemberId = new Map<number, number>();
  const items: ForestPlacedItem[] = [];

  const rootSize = getCardSizeForTier('root', spec);
  const rootX = Math.round(spec.viewportWidth / 2 - rootSize.width / 2);
  const rootY = spec.padding;
  items.push({
    memberId: root.id,
    parentId: null,
    branchIndex: -1,
    columnIndex: -1,
    x: rootX,
    y: rootY,
    width: rootSize.width,
    height: rootSize.height,
    kind: 'card',
    cardTier: 'root',
  });

  const cardBottom = rootY + rootSize.height;
  const founderRailTop = cardBottom + spec.founderStemHeight;
  const panelsTop = cardBottom + spec.founderStemHeight + spec.founderConnectorHeight;
  const branchHeadSize = getCardSizeForTier('branch-head', spec);
  const firstRowContentTop = getBranchContentTop(
    panelsTop,
    branchHeadSize.height,
    spec.generationGap,
  );
  const columnBottoms = Array.from(
    { length: spec.columnCount },
    () => firstRowContentTop + spec.panelPadding,
  );
  const columnMemberCounts = Array.from({ length: spec.columnCount }, () => 0);
  const columnBranchNames = Array.from({ length: spec.columnCount }, () => null as string | null);
  const branchHeadTops: Array<{ x: number; y: number } | null> = Array.from(
    { length: spec.columnCount },
    () => null,
  );

  const gen2Rows: LayoutTreeNode[][] = [];
  for (let start = 0; start < branches.length; start += spec.columnCount) {
    gen2Rows.push(branches.slice(start, start + spec.columnCount));
  }

  let rowTop = panelsTop;

  gen2Rows.forEach((rowBranches) => {
    const rowColumnBottoms = Array.from({ length: spec.columnCount }, () => rowTop);
    const rowBranchHeadY = rowTop;

    rowBranches.forEach((branch, colInRow) => {
      const branchIndex = branches.indexOf(branch);
      const columnIndex = colInRow;
      const columnLeft = spec.padding + columnIndex * (columnWidth + spec.columnGap);
      tagBranch(branch, branchIndex, branchByMemberId);

      if (branchHeadTops[columnIndex] == null) {
        branchHeadTops[columnIndex] = {
          x: columnLeft + columnWidth / 2,
          y: rowBranchHeadY,
        };
      }

      const branchBottom = layoutBranchColumn(
        branch,
        branchIndex,
        columnIndex,
        columnLeft,
        columnWidth,
        rowBranchHeadY,
        root.id,
        members,
        baseline,
        spec,
        expandedGen5ParentIds,
        items,
      );

      rowColumnBottoms[columnIndex] = Math.max(rowColumnBottoms[columnIndex], branchBottom);
      columnBottoms[columnIndex] = Math.max(columnBottoms[columnIndex], branchBottom);
      columnMemberCounts[columnIndex] += countSubtree(branch);
      if (!columnBranchNames[columnIndex]) {
        columnBranchNames[columnIndex] = branch.fullName;
      }
    });

    const rowMaxBottom = Math.max(
      ...rowColumnBottoms.slice(0, rowBranches.length),
      rowBranchHeadY + branchHeadSize.height,
    );
    rowTop = rowMaxBottom + GEN2_ROW_GAP;
  });

  const panelContentTop = firstRowContentTop;

  let maxY = panelsTop;
  items.forEach((item) => {
    maxY = Math.max(maxY, item.y + item.height);
  });
  columnBottoms.forEach((bottom) => {
    maxY = Math.max(maxY, bottom);
  });
  const forestHeight = maxY + spec.padding;

  const panels: ForestBranchPanel[] = Array.from(
    { length: spec.columnCount },
    (_, columnIndex) => ({
      columnIndex,
      branchIndex: columnIndex < branches.length ? columnIndex : null,
      left: spec.padding + columnIndex * (columnWidth + spec.columnGap),
      top: panelContentTop,
      width: columnWidth,
      height: Math.max(columnBottoms[columnIndex], panelContentTop + 80) - panelContentTop,
      color: getForestPanelColor(columnIndex),
      memberCount: columnMemberCounts[columnIndex],
      branchName: columnBranchNames[columnIndex] ?? undefined,
    }),
  );

  const founderRail: ForestFounderRail = {
    top: founderRailTop,
    height: spec.founderConnectorHeight,
    founderStemHeight: spec.founderStemHeight,
    founderBottom: {
      x: rootX + rootSize.width / 2,
      y: founderRailTop,
    },
    branchTops: branchHeadTops.map((point, columnIndex) => {
      if (point) return point;
      const columnLeft = spec.padding + columnIndex * (columnWidth + spec.columnGap);
      return {
        x: columnLeft + columnWidth / 2,
        y: panelsTop + spec.panelPadding,
      };
    }),
  };

  return {
    items,
    branchByMemberId,
    panels,
    founderRail,
    height: forestHeight,
  };
}

export function getItemCenter(item: ForestPlacedItem): { x: number; y: number } {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

export function getItemBottomCenter(item: ForestPlacedItem): { x: number; y: number } {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height,
  };
}

export function getItemTopCenter(item: ForestPlacedItem): { x: number; y: number } {
  return {
    x: item.x + item.width / 2,
    y: item.y,
  };
}
