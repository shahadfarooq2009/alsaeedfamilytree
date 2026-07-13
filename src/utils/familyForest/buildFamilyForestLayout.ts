import type { Edge, Node } from '@xyflow/react';

import type { PersonSummary } from '../../types/person';
import { getMemberFirstName } from '../normalizeFamilyData';
import { isFounderMember } from '../treeLayout/constants';
import { resolvePrimaryTreeParentId } from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from '../treeLayout/types';
import { getGenerationThemeClass, getGenerationThemeStyle } from '../generationTheme';
import { FOREST_BRANCH_COLORS, FOREST_BRANCH_HEAD_COLOR, getForestBranchColor, getForestBranchHeadThemeStyle } from './branchColors';
import { countGen2Branches, layoutForestColumns } from './forestColumnLayout';
import { buildForestEdges } from './forestEdges';
import { formatLifeDates } from './formatLifeDates';
import {
  forestExpandIconId,
  getForestViewportSpec,
  type ForestCardTier,
} from './forestViewport';

function getForestCardDisplayName(member: FamilyMemberInput): string {
  return getMemberFirstName(member.fullName);
}

export interface FamilyForestNodeData extends Record<string, unknown> {
  memberId: number;
  fullName: string;
  displayName: string;
  initial: string;
  photoUrl?: string | null;
  lifeDates: string | null;
  generation: number;
  generationClass: string;
  generationStyle: Record<string, string>;
  branchIndex: number;
  branchColor: string;
  isRoot: boolean;
  isBranchHead: boolean;
  cardTier: ForestCardTier;
  childCount: number;
  branchMemberCount?: number;
  isGen3Grid?: boolean;
  isHighlighted?: boolean;
  isSearchFocus?: boolean;
  isJustAdded?: boolean;
}

export interface ForestExpandIconData extends Record<string, unknown> {
  parentMemberId: number;
  childCount: number;
  isExpanded: boolean;
  branchColor: string;
}

export interface ForestInlineMemberData extends Record<string, unknown> {
  memberId: number;
  fullName: string;
  displayName: string;
  initial: string;
  childCount: number;
  generationClass: string;
  generationStyle: Record<string, string>;
  isHighlighted?: boolean;
  isSearchFocus?: boolean;
  isJustAdded?: boolean;
}

export interface ForestBranchPanelData extends Record<string, unknown> {
  columnIndex: number;
  branchColor: string;
  memberCount: number;
  branchName?: string;
}

export interface ForestFounderRailData extends Record<string, unknown> {
  founderBottom: { x: number; y: number };
  branchTops: Array<{ x: number; y: number }>;
  founderStemHeight: number;
}

export type ForestFlowNodeData =
  | FamilyForestNodeData
  | ForestExpandIconData
  | ForestInlineMemberData
  | ForestBranchPanelData
  | ForestFounderRailData;

export interface FamilyForestLayoutResult {
  nodes: Node<ForestFlowNodeData>[];
  edges: Edge[];
  width: number;
  height: number;
}

export interface FamilyForestLayoutOptions {
  /** Narrow layout width used for positioning (centered map). */
  viewportWidth: number;
  /** Full screen width — drives column count for gen-2 branches (up to 5). */
  screenWidth?: number;
  peopleById?: Map<number, PersonSummary>;
  expandedGen5ParentIds?: ReadonlySet<number>;
  selectedMemberId?: number | null;
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

export function buildFamilyForestLayout(
  members: FamilyMemberInput[],
  options: FamilyForestLayoutOptions,
): FamilyForestLayoutResult {
  const viewportWidth = Math.max(320, options.viewportWidth);
  const screenWidth = Math.max(320, options.screenWidth ?? options.viewportWidth);
  const gen2BranchCount = countGen2Branches(members);
  const spec = getForestViewportSpec(screenWidth, gen2BranchCount);
  const expandedGen5ParentIds = options.expandedGen5ParentIds ?? new Set<number>();
  const selectedMemberId = options.selectedMemberId ?? null;
  const peopleById = options.peopleById;
  const childCountById = buildChildCountMap(members);
  const memberById = new Map(members.map((member) => [member.id, member]));

  if (members.length === 0) {
    return { nodes: [], edges: [], width: viewportWidth, height: 600 };
  }

  const branchColors = [...FOREST_BRANCH_COLORS];
  const { items, branchByMemberId, panels, founderRail, height } = layoutForestColumns(
    members,
    spec,
    expandedGen5ParentIds,
    branchColors,
  );

  const nodes: Node<ForestFlowNodeData>[] = [];

  if (founderRail) {
    nodes.push({
      id: 'forest-founder-rail',
      type: 'forestFounderRail',
      position: { x: 0, y: founderRail.top },
      data: {
        founderBottom: {
          x: founderRail.founderBottom.x,
          y: founderRail.founderBottom.y - founderRail.top,
        },
        branchTops: founderRail.branchTops.map((point) => ({
          x: point.x,
          y: point.y - founderRail.top,
        })),
        founderStemHeight: founderRail.founderStemHeight,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      width: viewportWidth,
      height: founderRail.height,
      zIndex: 5,
    });
  }

  panels.forEach((panel) => {
    nodes.push({
      id: `forest-panel-${panel.columnIndex}`,
      type: 'forestBranchPanel',
      position: { x: panel.left, y: panel.top },
      data: {
        columnIndex: panel.columnIndex,
        branchColor: panel.color,
        memberCount: panel.memberCount,
        branchName: panel.branchName,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      width: panel.width,
      height: panel.height,
      zIndex: 0,
    });
  });

  items.forEach((item) => {
    if (item.kind === 'expand-icon') {
      const branchIndex = item.branchIndex;
      nodes.push({
        id: forestExpandIconId(item.parentId ?? item.memberId),
        type: 'forestExpandIcon',
        position: { x: item.x, y: item.y },
        data: {
          parentMemberId: item.parentId ?? item.memberId,
          childCount: item.childCount ?? 0,
          isExpanded: item.isExpanded ?? false,
          branchColor: getForestBranchColor(branchIndex),
        },
        draggable: false,
        selectable: false,
        width: item.width,
        height: item.height,
        zIndex: 9,
      });
      return;
    }

    const member = memberById.get(item.memberId);
    if (!member) return;

    const branchIndex = branchByMemberId.get(member.id) ?? item.branchIndex;
    const isBranchHead = item.cardTier === 'branch-head';
    const branchColor = isFounderMember(member)
      ? '#1e4d3e'
      : isBranchHead
        ? FOREST_BRANCH_HEAD_COLOR
        : getForestBranchColor(Math.max(0, branchIndex));
    const person = peopleById?.get(member.id);

    if (item.kind === 'inline') {
      nodes.push({
        id: String(member.id),
        type: 'forestInlineMember',
        position: { x: item.x, y: item.y },
        data: {
          memberId: member.id,
          fullName: member.fullName,
          displayName: getForestCardDisplayName(member),
          initial: member.initial,
          childCount: childCountById.get(member.id) ?? 0,
          generationClass: getGenerationThemeClass(member.generation),
          generationStyle: getGenerationThemeStyle(member.generation),
        },
        draggable: false,
        selectable: true,
        width: item.width,
        height: item.height,
        zIndex: 10,
      });
      return;
    }

    nodes.push({
      id: String(member.id),
      type: 'familyForest',
      position: { x: item.x, y: item.y },
      data: {
        memberId: member.id,
        fullName: member.fullName,
        displayName: getForestCardDisplayName(member),
        initial: member.initial,
        photoUrl: member.photoUrl ?? person?.photo_url ?? null,
        lifeDates: formatLifeDates(person?.birth_date, person?.death_date),
        generation: member.generation,
        generationClass: isBranchHead
          ? 'g-branch-head'
          : getGenerationThemeClass(member.generation),
        generationStyle: isBranchHead
          ? getForestBranchHeadThemeStyle()
          : getGenerationThemeStyle(member.generation),
        branchIndex,
        branchColor,
        isRoot: isFounderMember(member),
        isBranchHead,
        cardTier: item.cardTier,
        childCount: childCountById.get(member.id) ?? 0,
        branchMemberCount: item.branchMemberCount,
        isGen3Grid: item.isGen3Grid ?? false,
      },
      draggable: false,
      selectable: true,
      width: item.width,
      height: item.height,
      zIndex: isFounderMember(member) ? 14 : item.cardTier === 'branch-head' ? 13 : 12,
    });
  });

  const edges = buildForestEdges(
    items,
    members,
    selectedMemberId,
    expandedGen5ParentIds,
  );

  return {
    nodes,
    edges,
    width: Math.max(320, options.viewportWidth),
    height: Math.max(height, 520),
  };
}
