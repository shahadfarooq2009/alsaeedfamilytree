import type { FamilyTreeMapPerson } from '../components/family-tree-map/FamilyTreeMap';

/**
 * Turns a flat list of family members into an organic, oak-like tree layout.
 *
 * Positions come from recursive angular branching: the founder anchors the trunk
 * at the bottom centre, limbs fan outward and upward with depth-decaying length,
 * and every leaf node carries a dense cluster of foliage sprites. Filler sprites
 * fill the canopy oval so the crown reads as solid foliage.
 */

// ---- Tunables (px / degrees) ----
const TRUNK_LENGTH = 120;
const BASE_LENGTH = 150;
const LENGTH_DECAY = 0.78;
const SPREAD_PER_CHILD_DEG = 26;
const MAX_FAN_DEG = 140;
const OUTWARD_BIAS = 0.14;
const UPWARD_BIAS = 0.06;
const ANGLE_JITTER = 0.07;
const LEAF_CLUSTER_RADIUS = 42;
const LEAVES_PER_CLUSTER_MIN = 5;
const LEAVES_PER_CLUSTER_MAX = 9;
const FILLER_DENSITY = 1.35;
const MIN_THICKNESS = 1.5;
const MAX_THICKNESS = 34;
const BRANCH_CURVE_OFFSET = 22;
const PADDING = 140;
const LEAF_SPRITE_RADIUS = 11;
const MIN_SPRITE_GAP = 9;
const MIN_CLUSTER_GAP = 78;
const LEAF_BRANCH_LENGTH_BOOST = 0.11;
const CLUSTER_RELAX_ITERATIONS = 14;

const SPREAD_PER_CHILD = (SPREAD_PER_CHILD_DEG * Math.PI) / 180;
const MAX_FAN = (MAX_FAN_DEG * Math.PI) / 180;
const UP_ANGLE = Math.PI / 2;

export interface LeafSprite {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  variant: number;
}

export interface BotanicalNode {
  id: number;
  name: string;
  parentId: number | null;
  depth: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  subtreeSize: number;
  childrenCount: number;
  isRoot: boolean;
  isLeaf: boolean;
  leafSprites: LeafSprite[];
}

export interface BotanicalBranch {
  id: string;
  path: string;
  thickness: number;
  depth: number;
}

export interface BotanicalLayout {
  nodes: BotanicalNode[];
  branches: BotanicalBranch[];
  fillerSprites: LeafSprite[];
  width: number;
  height: number;
  maxDepth: number;
}

interface RawNode extends FamilyTreeMapPerson {
  children: RawNode[];
  subtreeSize: number;
  depth: number;
  x: number;
  y: number;
  angle: number;
  length: number;
}

/** Deterministic pseudo-random in [0, 1) seeded by a numeric key. */
function randFor(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Deterministic pseudo-random in [-1, 1] seeded by a node id. */
function jitterFor(seed: number): number {
  return randFor(seed) * 2 - 1;
}

function buildForest(people: FamilyTreeMapPerson[]): RawNode[] {
  const map = new Map<number, RawNode>();
  people.forEach((person) => {
    map.set(person.id, {
      ...person,
      children: [],
      subtreeSize: 1,
      depth: 0,
      x: 0,
      y: 0,
      angle: UP_ANGLE,
      length: 0,
    });
  });

  const roots: RawNode[] = [];
  map.forEach((node) => {
    if (node.parentId != null && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const measure = (node: RawNode): number => {
    node.subtreeSize =
      1 + node.children.reduce((sum, child) => sum + measure(child), 0);
    return node.subtreeSize;
  };
  roots.forEach(measure);

  return roots;
}

function thicknessFor(subtreeSize: number, rootSize: number): number {
  const ratio = subtreeSize / Math.max(rootSize, 1);
  const tapered = Math.pow(ratio, 0.55);
  return MIN_THICKNESS + (MAX_THICKNESS - MIN_THICKNESS) * tapered;
}

function branchLength(depth: number): number {
  return BASE_LENGTH * Math.pow(LENGTH_DECAY, depth);
}

function angleBiases(
  parentX: number,
  centerX: number,
  span: number,
): { outward: number; upward: number } {
  if (span <= 0) return { outward: 0, upward: 0 };
  const offset = (parentX - centerX) / span;
  return {
    outward: offset * OUTWARD_BIAS,
    upward: (1 - Math.min(Math.abs(offset), 1)) * UPWARD_BIAS,
  };
}

function childAngles(
  parentAngle: number,
  childCount: number,
  parentX: number,
  centerX: number,
  span: number,
  baseSeed: number,
  allLeaves = false,
): number[] {
  if (childCount === 0) return [];

  const spreadPerChild = Math.min(
    allLeaves ? SPREAD_PER_CHILD * 1.12 : SPREAD_PER_CHILD,
    MAX_FAN / Math.max(childCount - 1, 1),
  );

  return Array.from({ length: childCount }, (_, index) => {
    const centered = index - (childCount - 1) / 2;
    const jitter = jitterFor(baseSeed + index * 17) * ANGLE_JITTER;
    const { outward, upward } = angleBiases(parentX, centerX, span);
    return parentAngle + centered * spreadPerChild + jitter + outward + upward;
  });
}

function spriteHitRadius(scale: number): number {
  return LEAF_SPRITE_RADIUS * scale;
}

function spritesOverlap(a: LeafSprite, b: LeafSprite, gap = MIN_SPRITE_GAP): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  return dist < spriteHitRadius(a.scale) + spriteHitRadius(b.scale) + gap;
}

function placeSpriteCandidate(
  centerX: number,
  centerY: number,
  seed: number,
  radius: number,
  scale: number,
): Pick<LeafSprite, 'x' | 'y' | 'rotation' | 'scale' | 'variant'> {
  const angle = randFor(seed) * Math.PI * 2;
  const dist = (0.28 + randFor(seed + 7) * 0.72) * radius;
  return {
    x: centerX + Math.cos(angle) * dist,
    y: centerY + Math.sin(angle) * dist * 0.82,
    rotation: randFor(seed + 13) * 360 - 180,
    scale,
    variant: Math.floor(randFor(seed + 23) * 4),
  };
}

function generateLeafCluster(
  centerX: number,
  centerY: number,
  nodeId: number,
  isLeaf: boolean,
): LeafSprite[] {
  const count = leafCountFor(nodeId, isLeaf);
  const radius = isLeaf ? LEAF_CLUSTER_RADIUS : LEAF_CLUSTER_RADIUS * 0.5;
  const sprites: LeafSprite[] = [];

  for (let index = 0; index < count; index += 1) {
    const seed = nodeId * 1000 + index;
    const scale = 0.5 + randFor(seed + 19) * 0.5;
    let placed: LeafSprite | null = null;

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const candidate = placeSpriteCandidate(
        centerX,
        centerY,
        seed + attempt * 37,
        radius,
        scale,
      );
      if (!sprites.some((existing) => spritesOverlap(existing, candidate))) {
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      const ringAngle = (index / count) * Math.PI * 2 + randFor(seed) * 0.35;
      const ringDist = radius * (0.55 + (index % 3) * 0.12);
      placed = {
        x: centerX + Math.cos(ringAngle) * ringDist,
        y: centerY + Math.sin(ringAngle) * ringDist * 0.82,
        rotation: randFor(seed + 13) * 360 - 180,
        scale: scale * 0.92,
        variant: Math.floor(randFor(seed + 23) * 4),
      };
    }

    sprites.push(placed);
  }

  return sprites;
}

function clusterRadius(node: BotanicalNode): number {
  return node.isLeaf ? LEAF_CLUSTER_RADIUS : LEAF_CLUSTER_RADIUS * 0.5;
}

function collectCanopyNodes(roots: RawNode[]): RawNode[] {
  const canopy: RawNode[] = [];
  const walk = (node: RawNode): void => {
    if (node.depth === 0) {
      node.children.forEach(walk);
      return;
    }
    if (node.children.length === 0) {
      canopy.push(node);
    }
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return canopy;
}

function separateCanopyPositions(roots: RawNode[]): void {
  const canopyNodes = collectCanopyNodes(roots);
  if (canopyNodes.length < 2) return;

  const positions = canopyNodes.map((node) => ({
    node,
    x: node.x,
    y: node.y,
  }));

  for (let iteration = 0; iteration < CLUSTER_RELAX_ITERATIONS; iteration += 1) {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i];
        const b = positions[j];
        const minDist =
          LEAF_CLUSTER_RADIUS * 2 + MIN_CLUSTER_GAP * 0.38;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist < 1e-4) {
          const angle = randFor(a.node.id * 17 + b.node.id) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        if (dist >= minDist) continue;

        const push = (minDist - dist) * 0.52;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  positions.forEach(({ node, x, y }) => {
    node.x = x;
    node.y = y;
  });
}

function separateClusters(nodes: BotanicalNode[]): void {
  const canopyNodes = nodes.filter((node) => !node.isRoot && node.leafSprites.length > 0);
  if (canopyNodes.length < 2) return;

  const positions = canopyNodes.map((node) => ({
    node,
    x: node.x,
    y: node.y,
  }));

  for (let iteration = 0; iteration < 6; iteration += 1) {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i];
        const b = positions[j];
        const minDist =
          clusterRadius(a.node) + clusterRadius(b.node) + MIN_SPRITE_GAP * 1.6;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist < 1e-4) {
          const angle = randFor(a.node.id * 19 + b.node.id) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        if (dist >= minDist) continue;

        const push = (minDist - dist) * 0.45;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  positions.forEach(({ node, x, y }) => {
    const dx = x - node.x;
    const dy = y - node.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    node.x = x;
    node.y = y;
    node.leafSprites = node.leafSprites.map((sprite) => ({
      ...sprite,
      x: sprite.x + dx,
      y: sprite.y + dy,
    }));
  });
}

function generateFillerSprites(
  leafNodes: BotanicalNode[],
  namedLeafCount: number,
): LeafSprite[] {
  if (leafNodes.length === 0) return [];

  const occupied: LeafSprite[] = leafNodes.flatMap((node) => node.leafSprites);
  const count = Math.round(namedLeafCount * FILLER_DENSITY);
  const xs = leafNodes.map((node) => node.x);
  const ys = leafNodes.map((node) => node.y);
  const cx = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const cy = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const rx =
    Math.max(...xs.map((x) => Math.abs(x - cx))) + LEAF_CLUSTER_RADIUS * 0.75;
  const ry =
    Math.max(...ys.map((y) => Math.abs(y - cy))) + LEAF_CLUSTER_RADIUS * 0.62;

  const fillers: LeafSprite[] = [];

  for (let index = 0; index < count; index += 1) {
    const seed = index * 53 + 9001;
    const scale = 0.42 + randFor(seed + 9) * 0.42;
    let placed: LeafSprite | null = null;

    for (let attempt = 0; attempt < 22; attempt += 1) {
      const attemptSeed = seed + attempt * 41;
      const angle = randFor(attemptSeed) * Math.PI * 2;
      const dist = Math.sqrt(randFor(attemptSeed + 2));
      const candidate: LeafSprite = {
        x: cx + Math.cos(angle) * rx * dist,
        y: cy + Math.sin(angle) * ry * dist,
        rotation: randFor(attemptSeed + 5) * 360 - 180,
        scale,
        variant: Math.floor(randFor(attemptSeed + 11) * 4),
      };

      const nearCluster = leafNodes.some((node) => {
        const minDist = clusterRadius(node) + spriteHitRadius(scale) + MIN_SPRITE_GAP;
        return Math.hypot(candidate.x - node.x, candidate.y - node.y) < minDist;
      });
      const hitsFoliage =
        nearCluster ||
        occupied.some((sprite) => spritesOverlap(sprite, candidate, MIN_SPRITE_GAP * 0.6)) ||
        fillers.some((sprite) => spritesOverlap(sprite, candidate, MIN_SPRITE_GAP * 0.5));

      if (!hitsFoliage) {
        placed = candidate;
        break;
      }
    }

    if (placed) {
      fillers.push(placed);
      occupied.push(placed);
    }
  }

  return fillers;
}

/** Quadratic branch that arcs perpendicular to the growth direction. */
function branchPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  growthAngle: number,
  swaySeed: number,
): string {
  const t = 0.42 + randFor(swaySeed) * 0.16;
  const midX = fromX + (toX - fromX) * t;
  const midY = fromY + (toY - fromY) * t;
  const perpX = Math.sin(growthAngle);
  const perpY = Math.cos(growthAngle);
  const offset = jitterFor(swaySeed + 3) * BRANCH_CURVE_OFFSET;
  const cx = midX + perpX * offset;
  const cy = midY + perpY * offset;
  return `M ${fromX.toFixed(2)} ${fromY.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(
    2,
  )} ${toX.toFixed(2)} ${toY.toFixed(2)}`;
}

function leafCountFor(nodeId: number, isLeaf: boolean): number {
  const range = LEAVES_PER_CLUSTER_MAX - LEAVES_PER_CLUSTER_MIN + 1;
  const base = LEAVES_PER_CLUSTER_MIN + Math.floor(randFor(nodeId * 41) * range);
  return isLeaf ? base : Math.max(3, Math.floor(base * 0.5));
}

interface PlacementState {
  maxDepth: number;
  maxSpan: number;
  centerX: number;
}

function placeRadial(
  node: RawNode,
  parentX: number,
  parentY: number,
  parentAngle: number,
  depth: number,
  state: PlacementState,
  siblingCount = 1,
): void {
  node.depth = depth;
  state.maxDepth = Math.max(state.maxDepth, depth);

  if (depth === 0) {
    node.x = state.centerX;
    node.y = 0;
    node.angle = UP_ANGLE;
    node.length = 0;
    parentX = node.x;
    parentY = node.y - TRUNK_LENGTH;
    parentAngle = UP_ANGLE;
  } else {
    const isLeaf = node.children.length === 0;
    let length = branchLength(depth);
    if (isLeaf) {
      length *= 1 + Math.max(0, siblingCount - 1) * LEAF_BRANCH_LENGTH_BOOST;
    }
    node.length = length;
    node.angle = parentAngle;
    node.x = parentX + Math.cos(parentAngle) * length;
    node.y = parentY - Math.sin(parentAngle) * length;
    state.maxSpan = Math.max(state.maxSpan, Math.abs(node.x - state.centerX));
  }

  const childCount = node.children.length;
  const allLeaves =
    childCount > 0 && node.children.every((child) => child.children.length === 0);
  const angles = childAngles(
    parentAngle,
    childCount,
    node.x,
    state.centerX,
    Math.max(state.maxSpan, 1),
    node.id,
    allLeaves,
  );

  node.children.forEach((child, index) => {
    const childAngle = angles[index];
    const childParentX = depth === 0 ? parentX : node.x;
    const childParentY = depth === 0 ? parentY : node.y;
    placeRadial(
      child,
      childParentX,
      childParentY,
      childAngle,
      depth + 1,
      state,
      childCount,
    );
  });
}

export function buildBotanicalTreeLayout(
  people: FamilyTreeMapPerson[] = [],
): BotanicalLayout {
  const roots = buildForest(people);

  const nodes: BotanicalNode[] = [];
  const branches: BotanicalBranch[] = [];

  if (roots.length === 0) {
    return {
      nodes,
      branches,
      fillerSprites: [],
      width: PADDING * 2,
      height: PADDING * 2,
      maxDepth: 0,
    };
  }

  const rootSize = roots.reduce((sum, root) => sum + root.subtreeSize, 0);
  const state: PlacementState = { maxDepth: 0, maxSpan: 0, centerX: 0 };

  const primaryRoot = roots.reduce((largest, root) =>
    root.subtreeSize >= largest.subtreeSize ? root : largest,
  );
  placeRadial(primaryRoot, 0, 0, UP_ANGLE, 0, state);

  const otherRoots = roots.filter((root) => root.id !== primaryRoot.id);
  if (otherRoots.length > 0) {
    const spread = Math.min(SPREAD_PER_CHILD, MAX_FAN / Math.max(otherRoots.length, 1));
    otherRoots.forEach((root, index) => {
      const angle =
        UP_ANGLE +
        (index + 1 - (otherRoots.length + 1) / 2) * spread +
        jitterFor(root.id) * ANGLE_JITTER;
      root.x = state.centerX + Math.cos(angle) * branchLength(1) * 0.6;
      root.y = -Math.sin(angle) * branchLength(1) * 0.6;
      root.angle = angle;
      root.length = branchLength(1) * 0.6;
      root.depth = 0;
      const allLeaves =
        root.children.length > 0 &&
        root.children.every((child) => child.children.length === 0);
      const angles = childAngles(
        angle,
        root.children.length,
        root.x,
        state.centerX,
        Math.max(state.maxSpan, 1),
        root.id,
        allLeaves,
      );
      root.children.forEach((child, childIndex) => {
        placeRadial(
          child,
          root.x,
          root.y,
          angles[childIndex],
          1,
          state,
          root.children.length,
        );
      });
    });
  }

  separateCanopyPositions([primaryRoot, ...otherRoots]);

  const emitBranches = (node: RawNode, trunkFromRoot = false): void => {
    if (node.depth === 0) {
      const trunkTopY = node.y - TRUNK_LENGTH;
      branches.push({
        id: `trunk-${node.id}`,
        thickness: thicknessFor(node.subtreeSize, rootSize),
        depth: 0,
        path: branchPath(node.x, node.y, node.x, trunkTopY, UP_ANGLE, node.id),
      });

      const branchOriginY = trunkFromRoot ? node.y - TRUNK_LENGTH : trunkTopY;
      node.children.forEach((child) => {
        branches.push({
          id: `${node.id}-${child.id}`,
          thickness: thicknessFor(child.subtreeSize, rootSize),
          depth: child.depth,
          path: branchPath(
            node.x,
            branchOriginY,
            child.x,
            child.y,
            child.angle,
            child.id,
          ),
        });
        emitBranches(child);
      });
      return;
    }

    node.children.forEach((child) => {
      branches.push({
        id: `${node.id}-${child.id}`,
        thickness: thicknessFor(child.subtreeSize, rootSize),
        depth: child.depth,
        path: branchPath(node.x, node.y, child.x, child.y, child.angle, child.id),
      });
      emitBranches(child);
    });
  };

  const collect = (node: RawNode): void => {
    const isLeaf = node.children.length === 0;
    const leafSprites =
      isLeaf || node.depth >= state.maxDepth - 1
        ? generateLeafCluster(node.x, node.y, node.id, isLeaf)
        : [];

    nodes.push({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      depth: node.depth,
      x: node.x,
      y: node.y,
      angle: node.angle,
      length: node.length,
      subtreeSize: node.subtreeSize,
      childrenCount: node.childrenCount ?? node.children.length,
      isRoot: node.depth === 0,
      isLeaf,
      leafSprites,
    });

    node.children.forEach(collect);
  };

  emitBranches(primaryRoot);
  otherRoots.forEach((root) => emitBranches(root, true));
  collect(primaryRoot);
  otherRoots.forEach(collect);

  separateClusters(nodes);

  const namedLeafNodes = nodes.filter((node) => node.isLeaf && node.leafSprites.length > 0);
  const fillerSprites = generateFillerSprites(
    namedLeafNodes,
    namedLeafNodes.length,
  );

  const boundsX: number[] = [];
  const boundsY: number[] = [];

  const includeSprite = (sprite: LeafSprite) => {
    const r = LEAF_SPRITE_RADIUS * sprite.scale;
    boundsX.push(sprite.x - r, sprite.x + r);
    boundsY.push(sprite.y - r, sprite.y + r);
  };

  nodes.forEach((node) => {
    boundsX.push(node.x);
    boundsY.push(node.y);
    if (node.isRoot) {
      boundsX.push(node.x - 60, node.x + 60);
      boundsY.push(node.y - 45, node.y + 45);
    }
    node.leafSprites.forEach(includeSprite);
  });
  fillerSprites.forEach(includeSprite);

  const minX = Math.min(...boundsX);
  const minY = Math.min(...boundsY);
  const maxX = Math.max(...boundsX);
  const maxY = Math.max(...boundsY);
  const offsetX = PADDING - minX;
  const offsetY = PADDING - minY;

  const shiftSprite = (sprite: LeafSprite): LeafSprite => ({
    ...sprite,
    x: sprite.x + offsetX,
    y: sprite.y + offsetY,
  });

  const shiftedNodes: BotanicalNode[] = nodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
    leafSprites: node.leafSprites.map(shiftSprite),
  }));

  const shiftedBranches: BotanicalBranch[] = branches.map((branch) => ({
    ...branch,
    path: shiftPath(branch.path, offsetX, offsetY),
  }));

  return {
    nodes: shiftedNodes,
    branches: shiftedBranches,
    fillerSprites: fillerSprites.map(shiftSprite),
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
    maxDepth: state.maxDepth,
  };
}

/** Translate every coordinate pair in an SVG path string. */
function shiftPath(path: string, dx: number, dy: number): string {
  const parts = path.split(' ');
  const result: string[] = [];
  let index = 0;
  while (index < parts.length) {
    const token = parts[index];
    if (token === 'M' || token === 'Q' || token === 'C') {
      result.push(token);
      index += 1;
      continue;
    }
    const x = parseFloat(token);
    const y = parseFloat(parts[index + 1]);
    result.push((x + dx).toFixed(2), (y + dy).toFixed(2));
    index += 2;
  }
  return result.join(' ');
}
