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
 * One local family connector group per father:
 * parent top-center → short stem → split point → curved branch to each child bottom-center.
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

  const lowestChildY = Math.max(...childBottoms.map((point) => point.y));
  const verticalSpan = Math.max(8, parentTop.y - lowestChildY);

  const stemLength = isFounderMember(parent)
    ? Math.min(22, Math.max(14, verticalSpan * 0.18))
    : Math.min(18, Math.max(10, verticalSpan * 0.28));

  const splitY = parentTop.y - stemLength;
  const splitX = parentTop.x;

  const paths: BranchConnectorPath[] = [];

  paths.push({
    key: `stem-${parent.id}`,
    d: `M ${parentTop.x} ${parentTop.y} L ${splitX} ${splitY}`,
    type,
    groupId: parent.id,
    parentId: parent.id,
    childId: sorted[0].id,
  });

  sorted.forEach((child) => {
    const childBottom = bottomCenter(child);
    const horizontalReach = Math.abs(childBottom.x - splitX);
    const curveBias = isFounderMember(parent) ? 0.62 : 0.5;
    const midY = splitY + (childBottom.y - splitY) * 0.38;
    const controlX = splitX + (childBottom.x - splitX) * Math.min(curveBias, 0.35 + horizontalReach * 0.0008);
    paths.push({
      key: `branch-${parent.id}-${child.id}`,
      d: `M ${splitX} ${splitY} Q ${controlX} ${midY} ${childBottom.x} ${childBottom.y}`,
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
    gender: node.gender,
    generation: node.generation,
    initial: node.initial,
    photoUrl: node.photoUrl,
    relationLabel: node.relationLabel,
    x: node.x,
    y: node.y,
  };
}

function collectFatherChildGroups(
  roots: LayoutTreeNode[],
): Map<number, { parent: LayoutTreeNode; children: LayoutTreeNode[] }> {
  const groups = new Map<number, { parent: LayoutTreeNode; children: LayoutTreeNode[] }>();

  const walk = (parent: LayoutTreeNode) => {
    const directChildren = parent.children.filter(
      (child) => child.id >= 0 && child.fatherId === parent.id,
    );

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
  members: PositionedMember[] = [],
): BranchConnectorPath[] {
  const byKey = new Map<string, BranchConnectorPath>();

  collectFatherChildGroups(roots).forEach(({ parent, children }) => {
    familyGroupPaths(asPositioned(parent), children.map(asPositioned))
      .forEach((path) => byKey.set(path.key, path));
  });

  generateAllBranchPaths(members).forEach((path) => byKey.set(path.key, path));

  return Array.from(byKey.values());
}

/** Build connectors from direct father_id links only. */
export function generateAllBranchPaths(members: PositionedMember[]): BranchConnectorPath[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const childMap = new Map<number, PositionedMember[]>();

  members.forEach((member) => {
    if (member.fatherId == null || member.fatherId < 0) return;
    const list = childMap.get(member.fatherId) ?? [];
    list.push(member);
    childMap.set(member.fatherId, list);
  });

  const paths: BranchConnectorPath[] = [];
  childMap.forEach((children, parentId) => {
    const parent = byId.get(parentId);
    if (!parent) return;
    paths.push(...familyGroupPaths(parent, children));
  });

  return paths;
}
