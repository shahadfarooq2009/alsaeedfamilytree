import type { Edge } from '@xyflow/react';

import { resolvePrimaryTreeParentId } from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from '../treeLayout/types';
import {
  getItemBottomCenter,
  getItemTopCenter,
  type ForestPlacedItem,
} from './forestColumnLayout';
import { forestExpandIconId } from './forestViewport';

const LOCAL_EDGE_STYLE = {
  strokeWidth: 0.8,
  opacity: 0.3,
};

const HIGHLIGHT_EDGE_STYLE = {
  strokeWidth: 1.1,
  opacity: 0.55,
};

function nodeIdForItem(item: ForestPlacedItem): string {
  if (item.kind === 'expand-icon') {
    return forestExpandIconId(item.parentId ?? item.memberId);
  }
  return String(item.memberId);
}

function findItem(
  items: ForestPlacedItem[],
  memberId: number,
  kind?: ForestPlacedItem['kind'],
): ForestPlacedItem | undefined {
  return items.find((item) => item.memberId === memberId && (kind == null || item.kind === kind));
}

function isSameBranch(
  parentItem: ForestPlacedItem,
  childItem: ForestPlacedItem,
): boolean {
  return parentItem.branchIndex === childItem.branchIndex
    && parentItem.columnIndex === childItem.columnIndex;
}

function buildLocalEdge(
  parentItem: ForestPlacedItem,
  childItem: ForestPlacedItem,
  highlighted: boolean,
): Edge {
  const source = nodeIdForItem(parentItem);
  const target = nodeIdForItem(childItem);

  return {
    id: `forest-local-${source}-${target}`,
    source,
    target,
    type: 'forestLocal',
    sourceHandle: 'children',
    targetHandle: 'parent',
    data: {
      highlighted,
      parentBottom: getItemBottomCenter(parentItem),
      childTop: getItemTopCenter(childItem),
    },
    style: {
      stroke: '#8a7048',
      ...(highlighted ? HIGHLIGHT_EDGE_STYLE : LOCAL_EDGE_STYLE),
    },
    zIndex: 0,
    animated: false,
  };
}

function getAncestorChain(
  memberId: number,
  members: FamilyMemberInput[],
): number[] {
  const chain: number[] = [memberId];
  const memberIds = new Set(members.map((member) => member.id));
  let current = memberId;

  while (true) {
    const member = members.find((item) => item.id === current);
    const parentId = member ? resolvePrimaryTreeParentId(member) : null;
    if (parentId == null || !memberIds.has(parentId)) break;
    chain.unshift(parentId);
    current = parentId;
  }

  return chain;
}

function shouldUseFounderRailConnector(
  parentItem: ForestPlacedItem,
  childItem: ForestPlacedItem,
): boolean {
  return parentItem.cardTier === 'root' && childItem.cardTier === 'branch-head';
}

/** Always-visible short vertical connectors between direct parent and child. */
export function buildForestBranchConnectors(items: ForestPlacedItem[]): Edge[] {
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();

  items.forEach((childItem) => {
    if (childItem.parentId == null) return;

    const parentItem = findItem(items, childItem.parentId, 'card')
      ?? findItem(items, childItem.parentId);
    if (!parentItem || !isSameBranch(parentItem, childItem)) return;
    if (shouldUseFounderRailConnector(parentItem, childItem)) return;

    const parentBottom = getItemBottomCenter(parentItem).y;
    const childTop = getItemTopCenter(childItem).y;
    if (childTop <= parentBottom) return;

    const edge = buildLocalEdge(parentItem, childItem, false);
    if (edgeKeys.has(edge.id)) return;
    edgeKeys.add(edge.id);
    edges.push(edge);
  });

  return edges;
}

/** Highlighted lineage path when a card is selected. */
export function buildForestLineageEdges(
  items: ForestPlacedItem[],
  members: FamilyMemberInput[],
  selectedMemberId: number | null,
  expandedGen5ParentIds: ReadonlySet<number>,
): Edge[] {
  if (selectedMemberId == null) return [];

  const highlightIds = new Set(getAncestorChain(selectedMemberId, members));
  highlightIds.add(selectedMemberId);

  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();

  const addEdge = (
    parentItem: ForestPlacedItem,
    childItem: ForestPlacedItem,
    highlighted: boolean,
  ) => {
    if (!isSameBranch(parentItem, childItem)) return;

    const edge = buildLocalEdge(parentItem, childItem, highlighted);
    if (edgeKeys.has(edge.id)) return;
    edgeKeys.add(edge.id);
    edges.push(edge);
  };

  items.forEach((childItem) => {
    if (childItem.parentId == null) return;

    let parentItem = findItem(items, childItem.parentId, 'card');
    if (!parentItem && childItem.kind === 'inline') {
      parentItem = findItem(items, childItem.parentId, 'card');
    }
    if (!parentItem) return;
    if (shouldUseFounderRailConnector(parentItem, childItem)) return;

    const highlighted = highlightIds.has(childItem.memberId)
      && highlightIds.has(parentItem.memberId);

    if (!highlighted && childItem.memberId !== selectedMemberId) return;

    addEdge(parentItem, childItem, highlighted);
  });

  items
    .filter((item) => item.kind === 'expand-icon')
    .forEach((iconItem) => {
      const parentItem = findItem(items, iconItem.parentId ?? iconItem.memberId, 'card');
      if (!parentItem || !highlightIds.has(parentItem.memberId)) return;
      addEdge(parentItem, iconItem, true);
    });

  return edges;
}

export function buildForestEdges(
  items: ForestPlacedItem[],
  members: FamilyMemberInput[],
  selectedMemberId: number | null,
  expandedGen5ParentIds: ReadonlySet<number>,
): Edge[] {
  const branchConnectors = buildForestBranchConnectors(items);
  const lineageEdges = buildForestLineageEdges(
    items,
    members,
    selectedMemberId,
    expandedGen5ParentIds,
  );

  if (lineageEdges.length === 0) return branchConnectors;

  const lineageIds = new Set(lineageEdges.map((edge) => edge.id));
  const muted = branchConnectors.filter((edge) => !lineageIds.has(edge.id));
  return [...muted, ...lineageEdges];
}

/** @deprecated Use buildForestEdges */
export function buildForestLocalEdges(
  items: ForestPlacedItem[],
  members: FamilyMemberInput[],
  selectedMemberId: number | null,
  expandedGen5ParentIds: ReadonlySet<number>,
): Edge[] {
  return buildForestEdges(items, members, selectedMemberId, expandedGen5ParentIds);
}
