import type { Node } from '@xyflow/react';

import { computeCenteredViewport } from '../familyTreeFlowViewport';
import {
  DEFAULT_MAX_BASE_GENERATIONS,
} from '../gen5Expansion';
import { getDisplayGeneration, getGenerationBaseline } from '../progressiveTreeDisclosure';
import { resolvePrimaryTreeParentId } from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from '../treeLayout/types';
import type { ForestFlowNodeData } from './buildFamilyForestLayout';

export const FOREST_SEARCH_FOCUS_ZOOM = 1.12;

export function getGen5ParentIdForMember(
  memberId: number,
  members: FamilyMemberInput[],
): number | null {
  const member = members.find((entry) => entry.id === memberId);
  if (!member) return null;

  const baseline = getGenerationBaseline(members);
  if (getDisplayGeneration(member, baseline) !== DEFAULT_MAX_BASE_GENERATIONS + 1) {
    return null;
  }

  return resolvePrimaryTreeParentId(member);
}

export function findForestMemberNode(
  nodes: Array<Node<ForestFlowNodeData>>,
  memberId: number,
): Node<ForestFlowNodeData> | null {
  const id = String(memberId);
  const node = nodes.find(
    (entry) => entry.id === id
      && (entry.type === 'familyForest' || entry.type === 'forestInlineMember'),
  );

  return node ?? null;
}

export function computeForestMemberFocusViewport(
  node: Node<ForestFlowNodeData>,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const nodeWidth = node.width ?? 96;
  const nodeHeight = node.height ?? 64;
  const centerX = node.position.x + nodeWidth / 2;
  const centerY = node.position.y + nodeHeight / 2;

  return computeCenteredViewport(
    centerX,
    centerY,
    zoom,
    viewportWidth,
    viewportHeight,
  );
}

export function getForestNodeMemberId(node: Node<ForestFlowNodeData>): number | null {
  if (node.type !== 'familyForest' && node.type !== 'forestInlineMember') {
    return null;
  }

  return (node.data as { memberId: number }).memberId;
}
