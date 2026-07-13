import {
  cardWidthForMember,
  cardFootprintForMember,
  getSiblingGap,
  isFounderMember,
} from './constants';
import { MIN_CARD_GAP } from './cardBounds';
import { applyReferenceCanopyYByTreeDepth } from './generationYLayout';
import { usableStageRect, type LayoutStage } from './stageBounds';
import { placeSiblingRow, sortSiblingsByAddOrder } from './siblingOrder';
import type { LayoutTreeNode } from './types';

const SECTOR_COUNT = 3;
const SECTOR_INNER_PAD_FRAC = 0.012;

interface SectorRect {
  left: number;
  right: number;
  center: number;
}

function sectorRect(
  usable: ReturnType<typeof usableStageRect>,
  sectorIndex: number,
): SectorRect {
  const pad = usable.width * SECTOR_INNER_PAD_FRAC;
  const innerWidth = usable.width - pad * 2;
  const sectorWidth = innerWidth / SECTOR_COUNT;
  const left = usable.left + pad + sectorIndex * sectorWidth;
  const right = left + sectorWidth;
  return { left, right, center: (left + right) / 2 };
}

function countTreeNodes(root: LayoutTreeNode): number {
  let count = 0;
  const walk = (node: LayoutTreeNode): void => {
    if (node.id >= 0) count += 1;
    node.children.forEach(walk);
  };
  walk(root);
  return count;
}

function maxTreeDepth(root: LayoutTreeNode): number {
  let max = 1;
  const walk = (node: LayoutTreeNode, depth: number): void => {
    max = Math.max(max, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 1);
  return max;
}

/** Assign sector 0|1|2 from founder's direct children order (10 per sector). */
function assignReferenceSectors(root: LayoutTreeNode): Map<number, number> {
  const sectors = new Map<number, number>();
  const founderChildren = sortSiblingsByAddOrder(
    root.children.filter((child) => child.id >= 0),
  );

  const perSector = Math.max(1, Math.ceil(founderChildren.length / SECTOR_COUNT));

  founderChildren.forEach((child, index) => {
    sectors.set(child.id, Math.min(SECTOR_COUNT - 1, Math.floor(index / perSector)));
  });

  const inherit = (node: LayoutTreeNode, sector: number): void => {
    node.children.forEach((child) => {
      if (child.id >= 0) {
        sectors.set(child.id, sector);
      }
      inherit(child, sector);
    });
  };

  founderChildren.forEach((child) => {
    inherit(child, sectors.get(child.id) ?? 1);
  });

  return sectors;
}

function groupWidth(nodes: LayoutTreeNode[], gap: number): number {
  if (nodes.length === 0) return 0;
  return nodes.reduce((sum, node) => sum + cardWidthForMember(node), 0)
    + Math.max(0, nodes.length - 1) * gap;
}

function placeRowInSector(
  nodes: LayoutTreeNode[],
  sector: SectorRect,
  gap: number,
  rowIndex = 0,
): void {
  if (nodes.length === 0) return;

  const available = sector.right - sector.left;
  const sample = nodes[0];
  const cardWidth = cardWidthForMember(sample);
  const maxPerRow = Math.max(1, Math.floor((available + gap) / (cardWidth + gap)));

  if (nodes.length > maxPerRow) {
    for (let start = 0; start < nodes.length; start += maxPerRow) {
      placeRowInSector(
        nodes.slice(start, start + maxPerRow),
        sector,
        gap,
        rowIndex + Math.floor(start / maxPerRow),
      );
    }
    return;
  }

  const width = groupWidth(nodes, gap);
  let left = sector.center - width / 2;
  left = Math.max(sector.left, Math.min(left, sector.right - width));

  const rowStep = cardFootprintForMember(sample) + Math.max(MIN_CARD_GAP, gap);
  placeSiblingRow(nodes, left, gap, cardWidthForMember);
  if (rowIndex > 0) {
    nodes.forEach((node) => {
      node.y = Math.round(node.y - rowIndex * rowStep);
    });
  }
}

function realignParentsOverChildren(root: LayoutTreeNode): void {
  const walk = (node: LayoutTreeNode): void => {
    node.children.forEach(walk);
    const children = node.children.filter((child) => child.id >= 0);
    if (children.length === 0) return;

    const minX = Math.min(...children.map((child) => child.x));
    const maxX = Math.max(
      ...children.map((child) => child.x + cardWidthForMember(child)),
    );
    node.x = Math.round((minX + maxX) / 2 - cardWidthForMember(node) / 2);
  };
  walk(root);
}

/** True when tree matches reference demo shape (founder + 3 main branches). */
export function shouldUseReferenceSymmetricLayout(root: LayoutTreeNode): boolean {
  if (!isFounderMember(root)) return false;
  const founderChildCount = root.children.filter((child) => child.id >= 0).length;
  if (founderChildCount !== 3) return false;
  const total = countTreeNodes(root);
  // Flow view shows gens 1–4 only (~41 cards); full demo tree has 81 members.
  return total >= 35 && total <= 90;
}

export function layoutReferenceSymmetricTree(
  root: LayoutTreeNode,
  stage: LayoutStage,
): { maxGeneration: number } {
  const usable = usableStageRect(stage);
  const sectors = assignReferenceSectors(root);
  const maxDepth = maxTreeDepth(root);
  const byDepthSector = new Map<string, LayoutTreeNode[]>();

  const walk = (node: LayoutTreeNode, depth: number): void => {
    if (node.id >= 0 && depth > 1) {
      const sector = sectors.get(node.id) ?? 1;
      const key = `${depth}-${sector}`;
      const list = byDepthSector.get(key) ?? [];
      list.push(node);
      byDepthSector.set(key, list);
    }
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 1);

  root.x = Math.round(stage.width / 2 - cardWidthForMember(root) / 2);
  applyReferenceCanopyYByTreeDepth([root], stage.height);

  const baseGap = Math.max(MIN_CARD_GAP, getSiblingGap());

  for (let depth = 2; depth <= maxDepth; depth += 1) {
    for (let sectorIndex = 0; sectorIndex < SECTOR_COUNT; sectorIndex += 1) {
      const key = `${depth}-${sectorIndex}`;
      const nodes = sortSiblingsByAddOrder(byDepthSector.get(key) ?? []);
      if (nodes.length === 0) continue;

      const bounds = sectorRect(usable, sectorIndex);
      const rowWidth = groupWidth(nodes, baseGap);
      const gap = rowWidth > bounds.right - bounds.left
        ? Math.max(MIN_CARD_GAP, Math.floor(((bounds.right - bounds.left) - groupWidth(nodes, 0)) / Math.max(1, nodes.length - 1)))
        : baseGap;

      placeRowInSector(nodes, bounds, gap);
    }
  }

  realignParentsOverChildren(root);

  return { maxGeneration: maxDepth };
}
