import type { Edge, Node } from '@xyflow/react';

import type { FamilyTreeNodeData } from './buildFamilyTreeFlowLayout';
import type { FamilyMemberInput } from './treeLayout/types';

export function resolveMemberParentId(member: FamilyMemberInput): number | null {
  return member.fatherId ?? member.motherId ?? null;
}

export function getAncestorPathIds(
  nodeId: number | string,
  members: FamilyMemberInput[],
): string[] {
  const membersById = new Map(members.map((member) => [String(member.id), member]));
  const path: string[] = [];
  let current = membersById.get(String(nodeId));

  while (current) {
    path.push(String(current.id));

    const parentId = resolveMemberParentId(current);
    if (parentId == null) break;

    current = membersById.get(String(parentId));
  }

  return path.reverse();
}

export function getHighlightedEdgeIds(pathIds: string[]): Set<string> {
  const highlighted = new Set<string>();

  for (let i = 0; i < pathIds.length - 1; i += 1) {
    highlighted.add(`${pathIds[i]}-${pathIds[i + 1]}`);
  }

  return highlighted;
}

export function buildFamilyTreeEdgeId(
  parentId: number | string,
  childId: number | string,
): string {
  return `${parentId}-${childId}`;
}

const DEFAULT_EDGE_STYLE = {
  stroke: '#5c4828',
  strokeWidth: 3.75,
};

const HIGHLIGHTED_EDGE_STYLE = {
  stroke: '#d4a82a',
  strokeWidth: 3,
  filter: 'drop-shadow(0 0 3px rgba(212, 168, 42, 0.45))',
};

export function applyPathHighlightToEdges(
  rawEdges: Edge[],
  highlightedEdgeIds: Set<string>,
): Edge[] {
  return rawEdges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);

    return {
      ...edge,
      animated: false,
      style: isHighlighted ? HIGHLIGHTED_EDGE_STYLE : DEFAULT_EDGE_STYLE,
      className: isHighlighted ? 'golden-family-edge' : undefined,
    };
  });
}

export function applyPathHighlightToMemberNodes(
  rawNodes: Node<FamilyTreeNodeData>[],
  selectedNodeId: number | null,
  selectedPathIds: string[],
): Node<FamilyTreeNodeData>[] {
  const pathSet = new Set(selectedPathIds);
  const selectedKey = selectedNodeId != null ? String(selectedNodeId) : null;

  return rawNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isSelected: selectedKey === node.id,
      inSelectedPath: pathSet.has(node.id) && selectedKey !== node.id,
    },
  }));
}
