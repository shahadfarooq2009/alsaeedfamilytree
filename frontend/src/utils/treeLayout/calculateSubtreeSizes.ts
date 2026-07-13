import { cardWidthForMember, getSiblingGap } from './constants';
import type { LayoutTreeNode } from './types';

/** Bottom-up subtree width: max(card, sum of child subtrees + gaps). */
export function calculateSubtreeSizes(node: LayoutTreeNode): number {
  const selfWidth = cardWidthForMember(node);

  if (node.children.length === 0) {
    node.subtreeWidth = selfWidth;
    return node.subtreeWidth;
  }

  node.children.forEach(calculateSubtreeSizes);

  const childrenWidth = node.children.reduce((sum, child, index) => {
    const gap = index > 0 ? getSiblingGap() : 0;
    return sum + child.subtreeWidth + gap;
  }, 0);

  node.subtreeWidth = Math.max(selfWidth, childrenWidth);
  return node.subtreeWidth;
}

export function calculateForestSubtreeSizes(roots: LayoutTreeNode[]): void {
  roots.forEach(calculateSubtreeSizes);
}
