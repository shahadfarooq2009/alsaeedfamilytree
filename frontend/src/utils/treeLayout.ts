import { hierarchy, zoomIdentity, type ZoomTransform } from 'd3';
import type {
  PositionedLink,
  PositionedPerson,
  TreeLayoutResult,
  TreePersonNode,
} from '../types/tree';
import {
  canopyPolar,
  radiusForDepth,
} from './canopyPolar';
import {
  getNodeHeight,
  getNodeWidth,
  getTreeDensityMode,
  getTrunkWorldBounds,
  setLayoutDensityMode,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './nodeMetrics';
import { referenceComposition } from './referenceComposition';
import { trunkLayout } from '../features/family-tree/theme/treeAssets';

const isDev =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

interface CanopyHub {
  x: number;
  y: number;
}

interface AngularSector {
  min: number;
  max: number;
}

/**
 * Radial canopy layout:
 * - D3 hierarchy for relationships only.
 * - Founder fixed at bottom center.
 * - Canopy hub above founder; all other nodes placed on polar (radius, angle) arcs.
 * - Gen-1 occupies angular sectors around the hub — not a horizontal row.
 * - Descendants recurse within shrinking wedges of their parent branch.
 */
export function computeTreeLayout(roots: TreePersonNode[]): TreeLayoutResult {
  if (roots.length === 0) {
    return emptyLayout();
  }

  const countNodes = (nodes: TreePersonNode[]): number =>
    nodes.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);

  setLayoutDensityMode(getTreeDensityMode(countNodes(roots)));

  const virtualRoot: TreePersonNode = {
    id: 0,
    full_name: '__root__',
    generation_number: -1,
    gender: null,
    photo_url: null,
    father_id: null,
    mother_id: null,
    birth_date: null,
    death_date: null,
    children: roots,
  };

  const root = hierarchy<TreePersonNode>(virtualRoot, (node) => {
    const children = node.children as TreePersonNode[];
    return children.length > 0 ? children : undefined;
  });

  const nodeMap = new Map<number, PositionedPerson>();
  const nodes: PositionedPerson[] = [];
  const hub = getCanopyHub();

  const realRoots = roots.filter((r) => r.id !== 0);

  if (realRoots.length === 1) {
    const founderData = realRoots[0];
    const founder = createPositioned(founderData, 0);
    founder.worldX = hub.x;
    founder.worldY = WORLD_HEIGHT - referenceComposition.founderBottomMargin;
    nodes.push(founder);
    nodeMap.set(founder.id, founder);

    const gen1Children = founderData.children ?? [];
    layoutGen1Arc(hub, gen1Children, nodeMap, nodes);
  } else {
    layoutMultipleRootsArc(hub, realRoots, nodeMap, nodes);
  }

  resolveCanopyOverlaps(nodes, hub);

  const links: PositionedLink[] = [];
  root.links().forEach((link) => {
    if (link.source.data.id === 0) {
      return;
    }

    const source = nodeMap.get(link.source.data.id);
    const target = nodeMap.get(link.target.data.id);

    if (source && target) {
      links.push({ source, target });
    }
  });

  const bounds = computeWorldBounds(nodes);

  if (isDev) {
    logLayoutDiagnostics(nodes, bounds);
  }

  return {
    nodes,
    links,
    bounds,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
  };
}

function getCanopyHub(): CanopyHub {
  const founderY = WORLD_HEIGHT - referenceComposition.founderBottomMargin;
  return {
    x: WORLD_WIDTH / 2,
    y: founderY - canopyPolar.hubOffsetAboveFounder,
  };
}

function createPositioned(data: TreePersonNode, depth: number): PositionedPerson {
  return {
    id: data.id,
    data,
    worldX: 0,
    worldY: 0,
    depth,
    generation: data.generation_number,
  };
}

function polarToXY(
  hub: CanopyHub,
  radius: number,
  angle: number,
): { worldX: number; worldY: number } {
  return {
    worldX: hub.x + radius * Math.sin(angle),
    worldY: hub.y - radius * Math.cos(angle),
  };
}

function stableJitter(id: number, salt: number): number {
  return (((id * 92821 + salt * 68917) % 1000) / 1000 - 0.5) * 2;
}

function sanitizeAngle(angle: number, depth: number, id: number): number {
  let a = angle;
  if (depth === 1 && Math.abs(Math.sin(a)) < canopyPolar.minSinAngle) {
    a += (a >= 0 ? 1 : -1) * canopyPolar.minSinAngle * 1.4;
  }
  a += stableJitter(id, 3) * canopyPolar.angleJitter;
  return a;
}

function layoutGen1Arc(
  hub: CanopyHub,
  children: TreePersonNode[],
  nodeMap: Map<number, PositionedPerson>,
  nodes: PositionedPerson[],
): void {
  const count = children.length;
  if (count === 0) {
    return;
  }

  const totalArc = canopyPolar.gen1ArcSpan;
  const startAngle = -totalArc / 2;
  const sectorWidth = totalArc / count;
  const radius = radiusForDepth(1);

  children.forEach((childData, index) => {
    const centerAngle = startAngle + sectorWidth * (index + 0.5);
    const angle = sanitizeAngle(centerAngle, 1, childData.id);
    const r = radius + stableJitter(childData.id, 1) * canopyPolar.radiusJitter;
    const { worldX, worldY } = polarToXY(hub, r, angle);

    const positioned = createPositioned(childData, 1);
    positioned.worldX = worldX;
    positioned.worldY = worldY;
    nodes.push(positioned);
    nodeMap.set(positioned.id, positioned);

    const childSector: AngularSector = {
      min: centerAngle - (sectorWidth * 0.46),
      max: centerAngle + (sectorWidth * 0.46),
    };

    layoutPolarSubtree(hub, positioned, childData, childSector, nodeMap, nodes);
  });
}

function layoutPolarSubtree(
  hub: CanopyHub,
  parent: PositionedPerson,
  parentData: TreePersonNode,
  sector: AngularSector,
  nodeMap: Map<number, PositionedPerson>,
  nodes: PositionedPerson[],
): void {
  const children = parentData.children ?? [];
  if (children.length === 0) {
    return;
  }

  const childDepth = parent.depth + 1;
  const wedge = (sector.max - sector.min) * Math.pow(canopyPolar.wedgeShrinkPerGen, parent.depth);
  const centerAngle = (sector.min + sector.max) / 2;
  const childSectorHalf = wedge / 2;
  const childSector: AngularSector = {
    min: centerAngle - childSectorHalf,
    max: centerAngle + childSectorHalf,
  };

  const radius = radiusForDepth(childDepth);
  const count = children.length;

  children.forEach((childData, index) => {
    let angle: number;

    if (count === 1) {
      angle = centerAngle;
    } else {
      const t = index / (count - 1);
      angle = childSector.min + t * (childSector.max - childSector.min);
    }

    angle = sanitizeAngle(angle, childDepth, childData.id);
    const r = radius + stableJitter(childData.id, childDepth) * canopyPolar.radiusJitter;
    const { worldX, worldY } = polarToXY(hub, r, angle);

    let positioned = nodeMap.get(childData.id);

    if (!positioned) {
      positioned = createPositioned(childData, childDepth);
      nodes.push(positioned);
      nodeMap.set(positioned.id, positioned);
    } else {
      positioned.depth = childDepth;
    }

    positioned.worldX = worldX;
    positioned.worldY = worldY;

    const subSector: AngularSector = {
      min: angle - childSectorHalf * 0.55,
      max: angle + childSectorHalf * 0.55,
    };

    layoutPolarSubtree(hub, positioned, childData, subSector, nodeMap, nodes);
  });
}

function layoutMultipleRootsArc(
  hub: CanopyHub,
  roots: TreePersonNode[],
  nodeMap: Map<number, PositionedPerson>,
  nodes: PositionedPerson[],
): void {
  const totalArc = canopyPolar.gen1ArcSpan * 0.85;
  const startAngle = -totalArc / 2;
  const sectorWidth = totalArc / roots.length;
  const radius = radiusForDepth(0) + 80;

  roots.forEach((rootData, index) => {
    const centerAngle = startAngle + sectorWidth * (index + 0.5);
    const angle = sanitizeAngle(centerAngle, 0, rootData.id);
    const { worldX, worldY } = polarToXY(hub, radius, angle);

    const positioned = createPositioned(rootData, 0);
    positioned.worldX = worldX;
    positioned.worldY = worldY;
    nodes.push(positioned);
    nodeMap.set(positioned.id, positioned);

    const sector: AngularSector = {
      min: centerAngle - sectorWidth * 0.45,
      max: centerAngle + sectorWidth * 0.45,
    };

    layoutPolarSubtree(hub, positioned, rootData, sector, nodeMap, nodes);
  });
}

/** Push overlapping nodes apart along polar directions from hub. */
function resolveCanopyOverlaps(nodes: PositionedPerson[], hub: CanopyHub, maxPasses = 40): void {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];

        if (!boxesOverlap(a, b)) {
          continue;
        }

        const dx = b.worldX - a.worldX || (a.id < b.id ? 1 : -1);
        const dy = b.worldY - a.worldY;
        const overlapX =
          getNodeWidth(a.data) / 2 + getNodeWidth(b.data) / 2 + 16 - Math.abs(dx);
        const overlapY =
          getNodeHeight(a.data) / 2 + getNodeHeight(b.data) / 2 + 16 - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (a.depth === 0) {
            nudgePolar(b, hub, 0.02, 8);
          } else if (b.depth === 0) {
            nudgePolar(a, hub, -0.02, 8);
          } else {
            const pushAngle = (overlapX / 2 + 3) * (dx >= 0 ? 1 : -1) / 120;
            nudgePolar(a, hub, -pushAngle, -6);
            nudgePolar(b, hub, pushAngle, 6);
          }

          moved = true;
        }
      }
    }

    if (!moved) {
      break;
    }
  }
}

function nudgePolar(
  node: PositionedPerson,
  hub: CanopyHub,
  deltaAngle: number,
  deltaRadius: number,
): void {
  if (node.depth === 0) {
    return;
  }

  const dx = node.worldX - hub.x;
  const dy = hub.y - node.worldY;
  const radius = Math.hypot(dx, dy) + deltaRadius;
  const angle = Math.atan2(dx, dy) + deltaAngle;
  const pos = polarToXY(hub, Math.max(radiusForDepth(node.depth) * 0.85, radius), angle);
  node.worldX = pos.worldX;
  node.worldY = pos.worldY;
}

function computeWorldBounds(nodes: PositionedPerson[]) {
  const trunk = getTrunkWorldBounds();

  if (nodes.length === 0) {
    return { ...trunk };
  }

  let minX = trunk.minX;
  let maxX = trunk.maxX;
  let minY = trunk.minY;
  let maxY = trunk.maxY;

  nodes.forEach((node) => {
    const halfW = getNodeWidth(node.data) / 2;
    const halfH = getNodeHeight(node.data) / 2;

    minX = Math.min(minX, node.worldX - halfW);
    maxX = Math.max(maxX, node.worldX + halfW);
    minY = Math.min(minY, node.worldY - halfH);
    maxY = Math.max(maxY, node.worldY + halfH);
  });

  return {
    minX: minX - 70,
    maxX: maxX + 70,
    minY: minY - 80,
    maxY: maxY + 36,
  };
}

function emptyLayout(): TreeLayoutResult {
  const trunk = getTrunkWorldBounds();
  return {
    nodes: [],
    links: [],
    bounds: trunk,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
  };
}

function logLayoutDiagnostics(
  nodes: PositionedPerson[],
  bounds: TreeLayoutResult['bounds'],
): void {
  const table = nodes.map((node) => ({
    id: node.id,
    name: node.data.full_name,
    depth: node.depth,
    worldX: Math.round(node.worldX),
    worldY: Math.round(node.worldY),
  }));

  const gen1 = nodes.filter((n) => n.depth === 1);
  const gen1YSpread =
    gen1.length > 1
      ? Math.max(...gen1.map((n) => n.worldY)) - Math.min(...gen1.map((n) => n.worldY))
      : 0;

  console.group('[FamilyTree] polar canopy layout');
  console.table(table);
  console.info('bounds', bounds, 'gen1 Y spread', gen1YSpread);
  if (overlapsRemain(nodes)) {
    console.warn('overlapping pairs remain');
  }
  console.groupEnd();
}

function overlapsRemain(nodes: PositionedPerson[]): boolean {
  return findOverlappingNodes(nodes).length > 0;
}

export function findOverlappingNodes(nodes: PositionedPerson[]): Array<[number, number]> {
  const overlaps: Array<[number, number]> = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (boxesOverlap(nodes[i], nodes[j])) {
        overlaps.push([nodes[i].id, nodes[j].id]);
      }
    }
  }

  return overlaps;
}

function boxesOverlap(a: PositionedPerson, b: PositionedPerson): boolean {
  const pad = 10;
  const aHalfW = getNodeWidth(a.data) / 2 + pad;
  const aHalfH = getNodeHeight(a.data) / 2 + pad;
  const bHalfW = getNodeWidth(b.data) / 2 + pad;
  const bHalfH = getNodeHeight(b.data) / 2 + pad;

  return (
    Math.abs(a.worldX - b.worldX) < aHalfW + bHalfW &&
    Math.abs(a.worldY - b.worldY) < aHalfH + bHalfH
  );
}

export function bezierLinkPath(link: PositionedLink): string {
  const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y } = getLinkControlPoints(link);
  return `M ${p0x} ${p0y} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${p3x} ${p3y}`;
}

export function cubicPoint(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + ttt * p3x,
    y: uuu * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + ttt * p3y,
  };
}

/** Organic branch curves along parent→child polar direction (no horizontal rails). */
export function getLinkControlPoints(link: PositionedLink) {
  const parent = link.source;
  const child = link.target;
  const parentH = getNodeHeight(parent.data);
  const childH = getNodeHeight(child.data);

  const hub = getCanopyHub();
  const trunkCrownY =
    trunkLayout.y + trunkLayout.height * (1 - referenceComposition.trunkCrownFrac);

  const childAttachX = child.worldX;
  const childAttachY = child.worldY + childH / 2 - 2;

  let p0x: number;
  let p0y: number;

  if (parent.depth === 0) {
    const toChildX = child.worldX - hub.x;
    const toChildY = child.worldY - trunkCrownY;
    const len = Math.hypot(toChildX, toChildY) || 1;
    p0x = hub.x + (toChildX / len) * 50;
    p0y = trunkCrownY + (toChildY / len) * 20;
  } else {
    const dx = child.worldX - parent.worldX;
    const dy = child.worldY - parent.worldY;
    const len = Math.hypot(dx, dy) || 1;
    p0x = parent.worldX + (dx / len) * Math.min(28, parentH * 0.2);
    p0y = parent.worldY - parentH / 2 - 2 + (dy / len) * 8;
  }

  const p3x = childAttachX;
  const p3y = childAttachY;

  const vx = p3x - p0x;
  const vy = p3y - p0y;
  const dist = Math.hypot(vx, vy) || 1;
  const ux = vx / dist;
  const uy = vy / dist;

  const bow = parent.depth === 0 ? 0.22 : parent.depth === 1 ? 0.16 : 0.12;
  const px = -uy;
  const py = ux;
  const side = child.worldX >= hub.x ? 1 : -1;

  const p1x = p0x + ux * dist * 0.38 + px * dist * bow * side;
  const p1y = p0y + uy * dist * 0.38 + py * dist * bow * side;
  const p2x = p3x - ux * dist * 0.28 + px * dist * bow * 0.35 * side;
  const p2y = p3y - uy * dist * 0.28 + py * dist * bow * 0.35 * side;

  return { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y };
}

export function getFitTransform(
  layout: TreeLayoutResult,
  viewportWidth: number,
  viewportHeight: number,
): ZoomTransform {
  const { bounds, nodes } = layout;

  if (nodes.length === 0 || viewportWidth === 0 || viewportHeight === 0) {
    return zoomIdentity;
  }

  const fitWidth = bounds.maxX - bounds.minX;
  const fitHeight = bounds.maxY - bounds.minY;
  const paddingFactor = referenceComposition.fitPadding;
  const scale =
    Math.min(viewportWidth / fitWidth, viewportHeight / fitHeight) * paddingFactor;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const founder = nodes.find(
    (node) => node.depth === 0 || node.data.is_family_head,
  );
  const centerY = founder
    ? founder.worldY * 0.5 + ((bounds.minY + bounds.maxY) / 2) * 0.5
    : (bounds.minY + bounds.maxY) / 2;
  const translateX = viewportWidth / 2 - centerX * scale;
  const translateY = viewportHeight / 2 - centerY * scale;

  return zoomIdentity.translate(translateX, translateY).scale(scale);
}

export function getNodeFocusTransform(
  node: PositionedPerson,
  viewportWidth: number,
  viewportHeight: number,
  scale = 1.1,
): ZoomTransform {
  const translateX = viewportWidth / 2 - node.worldX * scale;
  const translateY = viewportHeight / 2 - node.worldY * scale;

  return zoomIdentity.translate(translateX, translateY).scale(scale);
}

export function buildPositionsById(
  nodes: PositionedPerson[],
): Map<number, PositionedPerson> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function getCanopyHubForRender(): CanopyHub {
  return getCanopyHub();
}
