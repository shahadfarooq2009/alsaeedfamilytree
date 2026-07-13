import type { LayoutTreeNode } from './types';

/** Registration order: lowest id = added first. */
export function compareSiblingsByAddOrder(a: { id: number }, b: { id: number }): number {
  return a.id - b.id;
}

export function sortSiblingsByAddOrder<T extends { id: number }>(siblings: T[]): T[] {
  return [...siblings].sort(compareSiblingsByAddOrder);
}

export function sortSiblingTree(node: LayoutTreeNode): void {
  node.children = sortSiblingsByAddOrder(node.children);
  node.children.forEach(sortSiblingTree);
}

/**
 * X positions for a sibling row: first-added (lowest id) is rightmost (RTL).
 */
export function computeRtlRowXs(
  rowLeft: number,
  cardWidths: number[],
  gap: number,
): number[] {
  if (cardWidths.length === 0) return [];

  const totalWidth = cardWidths.reduce(
    (sum, width, index) => sum + width + (index < cardWidths.length - 1 ? gap : 0),
    0,
  );

  let x = rowLeft + totalWidth;
  return cardWidths.map((width, index) => {
    x -= width;
    const position = Math.round(x);
    if (index < cardWidths.length - 1) x -= gap;
    return position;
  });
}

/**
 * Lay siblings in one row: first-added (lowest id) is rightmost (RTL).
 * `rowLeft` is the left edge of the allotted slot.
 */
export function placeSiblingRow(
  children: LayoutTreeNode[],
  rowLeft: number,
  siblingGap: number,
  cardWidth: (node: LayoutTreeNode) => number,
): void {
  if (children.length === 0) return;

  const ordered = sortSiblingsByAddOrder(children);
  const widths = ordered.map((child) => cardWidth(child));
  const positions = computeRtlRowXs(rowLeft, widths, siblingGap);
  ordered.forEach((child, index) => {
    child.x = positions[index];
  });
}
