import type { HierarchyNode } from './person';

export interface TreePersonNode extends HierarchyNode {
  father_id: number | null;
  mother_id: number | null;
  children: TreePersonNode[];
}

/** Final world-space position for one person node. */
export interface PositionedPerson {
  id: number;
  data: TreePersonNode;
  worldX: number;
  worldY: number;
  depth: number;
  generation: number;
}

/** @deprecated Use PositionedPerson */
export type PositionedNode = PositionedPerson;

export interface PositionedLink {
  source: PositionedPerson;
  target: PositionedPerson;
}

export interface TreeLayoutResult {
  nodes: PositionedPerson[];
  links: PositionedLink[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  worldWidth: number;
  worldHeight: number;
}

export { TREE_NODE_HEIGHT, TREE_NODE_WIDTH } from '../utils/nodeMetrics';
