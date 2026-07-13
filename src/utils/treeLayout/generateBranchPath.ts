import {
  cardHeightForMember,
  cardWidthForMember,
  isFounderMember,
} from './constants';
import type { BranchConnectorPath, LayoutTreeNode, PositionedMember } from './types';

function topCenter(member: Pick<PositionedMember, 'x' | 'y' | 'fatherId' | 'generation' | 'fullName'>) {
  const width = cardWidthForMember(member);
  return { x: member.x + width / 2, y: member.y };
}

function bottomCenter(member: Pick<PositionedMember, 'x' | 'y' | 'fatherId' | 'generation' | 'fullName'>) {
  const width = cardWidthForMember(member);
  const height = cardHeightForMember(member);
  return { x: member.x + width / 2, y: member.y + height };
}

/**
 * Bottom-up orthogonal connector (reference image):
 * parent top-center → vertical stem up → horizontal bus → vertical stems to child bottoms.
 */
function familyGroupPaths(
  parent: PositionedMember,
  children: PositionedMember[],
): BranchConnectorPath[] {
  if (children.length === 0) return [];

  const parentTop = topCenter(parent);
  const sorted = [...children].sort((a, b) => a.x - b.x);
  const childBottoms = sorted.map(bottomCenter);
  const type = isFounderMember(parent) ? 'root' : 'child';

  if (sorted.length === 1) {
    const childBottom = childBottoms[0];
    const midY = Math.round((parentTop.y + childBottom.y) / 2);
    return [
      {
        key: `stem-${parent.id}-${sorted[0].id}`,
        d: `M ${parentTop.x} ${parentTop.y} L ${parentTop.x} ${midY} L ${childBottom.x} ${midY} L ${childBottom.x} ${childBottom.y}`,
        type,
        groupId: parent.id,
        parentId: parent.id,
        childId: sorted[0].id,
      },
    ];
  }

  const highestChildBottomY = Math.min(...childBottoms.map((point) => point.y));
  const verticalSpan = Math.max(12, parentTop.y - highestChildBottomY);
  const stemLength = isFounderMember(parent)
    ? Math.min(36, Math.max(18, verticalSpan * 0.22))
    : Math.min(28, Math.max(12, verticalSpan * 0.24));

  const splitY = parentTop.y - stemLength;
  const paths: BranchConnectorPath[] = [];

  paths.push({
    key: `stem-${parent.id}`,
    d: `M ${parentTop.x} ${parentTop.y} L ${parentTop.x} ${splitY}`,
    type,
    groupId: parent.id,
    parentId: parent.id,
    childId: sorted[0].id,
  });

  const minX = Math.min(...childBottoms.map((point) => point.x));
  const maxX = Math.max(...childBottoms.map((point) => point.x));

  if (Math.abs(maxX - minX) > 2) {
    paths.push({
      key: `split-${parent.id}`,
      d: `M ${minX} ${splitY} L ${maxX} ${splitY}`,
      type: 'child',
      groupId: parent.id,
      parentId: parent.id,
      childId: sorted[0].id,
    });
  }

  sorted.forEach((child) => {
    const childBottom = bottomCenter(child);
    paths.push({
      key: `branch-${parent.id}-${child.id}`,
      d: `M ${childBottom.x} ${splitY} L ${childBottom.x} ${childBottom.y}`,
      type: 'child',
      groupId: parent.id,
      parentId: parent.id,
      childId: child.id,
    });
  });

  return paths;
}

function asPositioned(node: LayoutTreeNode): PositionedMember {
  return {
    id: node.id,
    fullName: node.fullName,
    fatherId: node.fatherId,
    motherId: node.motherId,
    treeParentId: node.treeParentId,
    displayParentId: node.displayParentId,
    gender: node.gender,
    generation: node.generation,
    initial: node.initial,
    photoUrl: node.photoUrl,
    relationLabel: node.relationLabel,
    x: node.x,
    y: node.y,
    primaryTreeParentId: node.primaryTreeParentId,
    mainBranchRootId: node.mainBranchRootId,
  };
}

function collectPrimaryParentGroups(
  roots: LayoutTreeNode[],
): Map<number, { parent: LayoutTreeNode; children: LayoutTreeNode[] }> {
  const groups = new Map<number, { parent: LayoutTreeNode; children: LayoutTreeNode[] }>();

  const walk = (parent: LayoutTreeNode) => {
    const directChildren = parent.children.filter((child) => child.id >= 0);
    if (parent.id >= 0 && directChildren.length > 0) {
      groups.set(parent.id, { parent, children: directChildren });
    }
    parent.children.forEach(walk);
  };

  roots.forEach(walk);
  return groups;
}

export function generateBranchPathsFromLayout(
  roots: LayoutTreeNode[],
  _members: PositionedMember[] = [],
): BranchConnectorPath[] {
  const paths: BranchConnectorPath[] = [];

  collectPrimaryParentGroups(roots).forEach(({ parent, children }) => {
    familyGroupPaths(asPositioned(parent), children.map(asPositioned))
      .forEach((path) => paths.push(path));
  });

  return paths;
}

/** @deprecated Use generateBranchPathsFromLayout with hierarchy tree. */
export function generateAllBranchPaths(members: PositionedMember[]): BranchConnectorPath[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const childMap = new Map<number, PositionedMember[]>();

  members.forEach((member) => {
    const parentId = member.primaryTreeParentId;
    if (parentId == null || parentId < 0) return;
    const list = childMap.get(parentId) ?? [];
    list.push(member);
    childMap.set(parentId, list);
  });

  const paths: BranchConnectorPath[] = [];
  childMap.forEach((children, parentId) => {
    const parent = byId.get(parentId);
    if (!parent) return;
    paths.push(...familyGroupPaths(parent, children));
  });

  return paths;
}
