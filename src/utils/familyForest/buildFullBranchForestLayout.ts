import type { Edge, Node } from '@xyflow/react';

import type { PersonSummary } from '../../types/person';
import {
  chunkMembers,
  GEN5_GAP_X,
  GEN5_ICON_GAP,
  GEN5_ICON_SIZE,
  GEN5_ROW_GAP,
  getGen4ParentsWithGen5Children,
  MAX_GEN5_PER_ROW,
} from '../gen5Expansion';
import { getMemberFirstName } from '../normalizeFamilyData';
import { getSpreadTreeLayoutPositions } from '../buildFamilyTreeFlowLayout';
import { buildFamilyTreeEdgeId } from '../familyTreeFlowPath';
import { isFounderMember } from '../treeLayout/constants';
import { resolvePrimaryTreeParentId } from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput, PositionedMember } from '../treeLayout/types';
import { getGenerationThemeClass, getGenerationThemeStyle } from '../generationTheme';
import { FOREST_BRANCH_HEAD_COLOR, getForestBranchHeadThemeStyle } from './branchColors';
import { buildForestEdges } from './forestEdges';
import { formatLifeDates } from './formatLifeDates';
import type { ForestPlacedItem } from './forestColumnLayout';
import {
  getCardSizeForTier,
  getForestViewportSpec,
  forestExpandIconId,
  type ForestCardTier,
} from './forestViewport';
import type {
  FamilyForestLayoutResult,
  FamilyForestNodeData,
  ForestExpandIconData,
  ForestFlowNodeData,
  ForestInlineMemberData,
} from './buildFamilyForestLayout';

const CANVAS_PADDING = 48;

function tierForGeneration(generation: number): ForestCardTier {
  if (generation <= 1) return 'root';
  if (generation === 2) return 'branch-head';
  if (generation === 3) return 'standard';
  if (generation === 4) return 'compact';
  return 'micro';
}

function buildChildCountMap(members: FamilyMemberInput[]): Map<number, number> {
  const counts = new Map<number, number>();
  const memberIds = new Set(members.map((member) => member.id));

  members.forEach((member) => {
    const parentId = resolvePrimaryTreeParentId(member);
    if (parentId == null || !memberIds.has(parentId)) return;
    counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
  });

  return counts;
}

function layoutGen5Positions(
  parent: PositionedMember,
  children: FamilyMemberInput[],
  spec: ReturnType<typeof getForestViewportSpec>,
): Array<{ member: FamilyMemberInput; x: number; y: number }> {
  const rows = chunkMembers(children, MAX_GEN5_PER_ROW);
  const parentSize = getCardSizeForTier(tierForGeneration(parent.generation), spec);
  const childSize = getCardSizeForTier('micro', spec);
  const parentCenterX = parent.x + parentSize.width / 2;
  let currentY = parent.y - GEN5_ICON_GAP - GEN5_ICON_SIZE - GEN5_ROW_GAP;
  const positions: Array<{ member: FamilyMemberInput; x: number; y: number }> = [];

  rows.forEach((row) => {
    const rowWidth = row.length * childSize.width + Math.max(0, row.length - 1) * GEN5_GAP_X;
    let x = parentCenterX - rowWidth / 2;

    row.forEach((member) => {
      positions.push({ member, x, y: currentY });
      x += childSize.width + GEN5_GAP_X;
    });

    currentY -= childSize.height + GEN5_ROW_GAP;
  });

  return positions;
}

function measureLayoutBounds(
  items: ForestPlacedItem[],
  padding = CANVAS_PADDING,
): { width: number; height: number; offsetX: number; offsetY: number } {
  if (items.length === 0) {
    return { width: 800, height: 600, offsetX: padding, offsetY: padding };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach((item) => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  const offsetX = padding - minX;
  const offsetY = padding - minY;

  return {
    width: Math.ceil(maxX - minX + padding * 2),
    height: Math.ceil(maxY - minY + padding * 2),
    offsetX,
    offsetY,
  };
}

function toForestMemberNode(
  member: FamilyMemberInput,
  position: { x: number; y: number },
  spec: ReturnType<typeof getForestViewportSpec>,
  childCountById: Map<number, number>,
  peopleById: Map<number, PersonSummary> | undefined,
  branchIndex: number,
): Node<FamilyForestNodeData> {
  const tier = tierForGeneration(member.generation);
  const size = getCardSizeForTier(tier, spec);
  const isRoot = isFounderMember(member);
  const isBranchHead = member.generation === 2;
  const person = peopleById?.get(member.id);
  const childCount = childCountById.get(member.id) ?? 0;

  const generationClass = isBranchHead
    ? 'g-branch-head'
    : getGenerationThemeClass(member.generation);
  const generationStyle = isBranchHead
    ? getForestBranchHeadThemeStyle()
    : getGenerationThemeStyle(member.generation);

  return {
    id: String(member.id),
    type: 'familyForest',
    position,
    data: {
      memberId: member.id,
      fullName: member.fullName,
      displayName: getMemberFirstName(member.fullName),
      initial: member.initial,
      photoUrl: person?.photo_url ?? member.photoUrl ?? null,
      lifeDates: formatLifeDates(person?.birth_date, person?.death_date),
      generation: member.generation,
      generationClass,
      generationStyle,
      branchIndex,
      branchColor: isRoot
        ? '#1e4d3e'
        : isBranchHead
          ? FOREST_BRANCH_HEAD_COLOR
          : '#6f8161',
      isRoot,
      isBranchHead,
      cardTier: tier,
      childCount,
      isGen3Grid: false,
    } satisfies FamilyForestNodeData,
    draggable: false,
    selectable: true,
    width: size.width,
    height: size.height,
    zIndex: isRoot ? 14 : isBranchHead ? 13 : 12,
  };
}

export interface FullBranchForestLayoutOptions {
  viewportWidth: number;
  peopleById?: Map<number, PersonSummary>;
  selectedMemberId?: number | null;
  expandedGen5ParentIds?: ReadonlySet<number>;
  showAllGen5?: boolean;
}

/** Full branch tree — spread layout like reference tree, forest card styling. */
export function buildFullBranchForestLayout(
  members: FamilyMemberInput[],
  options: FullBranchForestLayoutOptions,
): FamilyForestLayoutResult {
  const viewportWidth = Math.max(640, options.viewportWidth);
  const spec = getForestViewportSpec(viewportWidth);
  const childCountById = buildChildCountMap(members);
  const peopleById = options.peopleById;
  const selectedMemberId = options.selectedMemberId ?? null;
  const expandedGen5ParentIds = options.showAllGen5
    ? new Set(getGen4ParentsWithGen5Children(members).keys())
    : (options.expandedGen5ParentIds ?? new Set<number>());

  if (members.length === 0) {
    return { nodes: [], edges: [], width: viewportWidth, height: 600 };
  }

  const { baseMembers, positionedById } = getSpreadTreeLayoutPositions(members);
  const gen4ParentsWithGen5 = getGen4ParentsWithGen5Children(members);
  const items: ForestPlacedItem[] = [];
  const nodes: Node<ForestFlowNodeData>[] = [];
  const smoothEdges: Edge[] = [];

  baseMembers.forEach((member) => {
    const positioned = positionedById.get(member.id);
    if (!positioned) return;

    const tier = tierForGeneration(member.generation);
    const size = getCardSizeForTier(tier, spec);

    items.push({
      memberId: member.id,
      parentId: resolvePrimaryTreeParentId(member),
      branchIndex: positioned.mainBranchRootId ?? 0,
      columnIndex: 0,
      x: positioned.x,
      y: positioned.y,
      width: size.width,
      height: size.height,
      kind: 'card',
      cardTier: tier,
      childCount: childCountById.get(member.id) ?? 0,
    });

    nodes.push(toForestMemberNode(
      member,
      { x: positioned.x, y: positioned.y },
      spec,
      childCountById,
      peopleById,
      positioned.mainBranchRootId ?? 0,
    ));
  });

  gen4ParentsWithGen5.forEach((gen5Children, parentId) => {
    const parent = positionedById.get(parentId);
    if (!parent) return;

    const parentSize = getCardSizeForTier(tierForGeneration(parent.generation), spec);
    const parentCenterX = parent.x + parentSize.width / 2;
    const isExpanded = expandedGen5ParentIds.has(parentId);

    if (!isExpanded) {
      items.push({
        memberId: parentId,
        parentId,
        branchIndex: parent.mainBranchRootId ?? 0,
        columnIndex: 0,
        x: parentCenterX - spec.expandIconSize / 2,
        y: parent.y - GEN5_ICON_GAP - spec.expandIconSize,
        width: spec.expandIconSize,
        height: spec.expandIconSize,
        kind: 'expand-icon',
        cardTier: 'micro',
        childCount: gen5Children.length,
        isExpanded: false,
      });

      nodes.push({
        id: forestExpandIconId(parentId),
        type: 'forestExpandIcon',
        position: {
          x: parentCenterX - spec.expandIconSize / 2,
          y: parent.y - GEN5_ICON_GAP - spec.expandIconSize,
        },
        data: {
          parentMemberId: parentId,
          childCount: gen5Children.length,
          isExpanded: false,
          branchColor: '#6f8161',
        } satisfies ForestExpandIconData,
        draggable: false,
        selectable: false,
        width: spec.expandIconSize,
        height: spec.expandIconSize,
        zIndex: 9,
      });
      return;
    }

    const childPositions = layoutGen5Positions(parent, gen5Children, spec);
    const microSize = getCardSizeForTier('micro', spec);

    childPositions.forEach(({ member, x, y }) => {
      items.push({
        memberId: member.id,
        parentId,
        branchIndex: parent.mainBranchRootId ?? 0,
        columnIndex: 0,
        x,
        y,
        width: microSize.width,
        height: microSize.height,
        kind: 'inline',
        cardTier: 'micro',
        childCount: childCountById.get(member.id) ?? 0,
      });

      nodes.push({
        id: String(member.id),
        type: 'forestInlineMember',
        position: { x, y },
        data: {
          memberId: member.id,
          fullName: member.fullName,
          displayName: getMemberFirstName(member.fullName),
          initial: member.initial,
          childCount: childCountById.get(member.id) ?? 0,
          generationClass: getGenerationThemeClass(member.generation),
          generationStyle: getGenerationThemeStyle(member.generation),
        } satisfies ForestInlineMemberData,
        draggable: false,
        selectable: false,
        width: microSize.width,
        height: microSize.height,
        zIndex: 11,
      });

      smoothEdges.push({
        id: buildFamilyTreeEdgeId(parentId, member.id),
        source: String(parentId),
        target: String(member.id),
        type: 'smoothstep',
        style: { stroke: '#8a9a82', strokeWidth: 1.2, opacity: 0.45 },
      });
    });
  });

  const bounds = measureLayoutBounds(items);
  const normalizedItems = items.map((item) => ({
    ...item,
    x: item.x + bounds.offsetX,
    y: item.y + bounds.offsetY,
  }));

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + bounds.offsetX,
      y: node.position.y + bounds.offsetY,
    },
  }));

  const forestEdges = buildForestEdges(normalizedItems, members, selectedMemberId, expandedGen5ParentIds);
  const normalizedSmoothEdges = smoothEdges.map((edge) => {
    const sourceNode = normalizedNodes.find((node) => node.id === edge.source);
    const targetNode = normalizedNodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return edge;
    return edge;
  });

  return {
    nodes: normalizedNodes,
    edges: [...forestEdges, ...normalizedSmoothEdges],
    width: Math.max(viewportWidth, bounds.width),
    height: Math.max(600, bounds.height),
  };
}
