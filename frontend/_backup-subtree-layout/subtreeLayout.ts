import { cardWidthForMember, isFounderMember } from './constants';
import { GENERATION_GAP, MAIN_BRANCH_GAP, SIBLING_GAP, SUBTREE_GAP } from './layoutConstants';
import { flattenLayoutNodes } from './buildFamilyHierarchy';
import type { LayoutTreeNode, PositionedMember } from './types';

export { SIBLING_GAP, SUBTREE_GAP, MAIN_BRANCH_GAP };

interface SubtreeBounds {
  left: number;
  right: number;
}

function maxTreeDepth(roots: LayoutTreeNode[]): number {
  let maxDepth = 1;
  const walk = (node: LayoutTreeNode, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 1));
  return maxDepth;
}

function sortedChildren(node: LayoutTreeNode): LayoutTreeNode[] {
  return node.children
    .filter((child) => child.id >= 0)
    .sort((a, b) => a.id - b.id);
}

function gapBeforeChild(
  _parent: LayoutTreeNode,
  childIndex: number,
  children: LayoutTreeNode[],
): number {
  if (childIndex <= 0) return 0;

  const prev = children[childIndex - 1];
  const current = children[childIndex];
  const prevHasDescendants = prev.children.some((c) => c.id >= 0);
  const currentHasDescendants = current.children.some((c) => c.id >= 0);

  if (prevHasDescendants || currentHasDescendants) {
    return SUBTREE_GAP;
  }

  return SIBLING_GAP;
}

/** Fixed vertical row positions — founder at bottom, canopy at top. */
export function depthYFixed(depth: number, maxDepth: number): number {
  const bottomRowY = (maxDepth - 1) * GENERATION_GAP;
  return bottomRowY - (depth - 1) * GENERATION_GAP;
}

function layoutSubtreeAt(
  node: LayoutTreeNode,
  startX: number,
  depth: number,
  maxDepth: number,
): SubtreeBounds {
  node.y = depthYFixed(depth, maxDepth);
  const children = sortedChildren(node);

  if (children.length === 0) {
    node.x = startX;
    const width = cardWidthForMember(node);
    return { left: startX, right: startX + width };
  }

  let cursor = startX;
  const childBounds: SubtreeBounds[] = [];

  children.forEach((child, index) => {
    if (index > 0) {
      cursor += gapBeforeChild(node, index, children);
    }
    childBounds.push(layoutSubtreeAt(child, cursor, depth + 1, maxDepth));
    cursor = childBounds[childBounds.length - 1].right;
  });

  const left = childBounds[0].left;
  const right = childBounds[childBounds.length - 1].right;
  const width = cardWidthForMember(node);
  node.x = (left + right) / 2 - width / 2;
  const parentLeft = node.x;
  const parentRight = node.x + width;
  node.subtreeWidth = Math.max(right, parentRight) - Math.min(left, parentLeft);
  return {
    left: Math.min(left, parentLeft),
    right: Math.max(right, parentRight),
  };
}

function nodesToPositioned(nodes: LayoutTreeNode[]): PositionedMember[] {
  return nodes.map((node) => ({
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
  }));
}

/**
 * Compact subtree layout:
 * - each main branch placed adjacent to the previous (no wide distribution)
 * - founder centered below the full branch group
 */
export function layoutTreeBySubtrees(roots: LayoutTreeNode[]): PositionedMember[] {
  if (roots.length === 0) return [];

  const founder = roots[0];
  const maxDepth = maxTreeDepth(roots);
  const branches = sortedChildren(founder);

  let cursor = 0;
  const branchBounds: SubtreeBounds[] = [];

  branches.forEach((branch, index) => {
    if (index > 0) {
      cursor += MAIN_BRANCH_GAP;
    }
    const bounds = layoutSubtreeAt(branch, cursor, 2, maxDepth);
    branchBounds.push(bounds);
    cursor = bounds.right;
  });

  founder.y = depthYFixed(1, maxDepth);

  if (branchBounds.length > 0) {
    const groupLeft = branchBounds[0].left;
    const groupRight = branchBounds[branchBounds.length - 1].right;
    founder.x = (groupLeft + groupRight) / 2 - cardWidthForMember(founder) / 2;
  } else {
    founder.x = 0;
  }

  founder.subtreeWidth = branchBounds.length > 0
    ? branchBounds[branchBounds.length - 1].right - branchBounds[0].left
    : cardWidthForMember(founder);

  return nodesToPositioned(flattenLayoutNodes(roots));
}

export function isFounderNode(node: LayoutTreeNode): boolean {
  return isFounderMember(node);
}
