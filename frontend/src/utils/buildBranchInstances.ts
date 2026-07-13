import type {
  AttachmentPoint,
  BranchCompositionResult,
  BranchInstance,
  LeafAnchor,
} from '../types/branchInstance';
import type { PositionedLink, TreeLayoutResult } from '../types/tree';
import { trunkLayout } from '../features/family-tree/theme/treeAssets';
import {
  BRANCH_ASSET_META,
  nativeReach,
  pickChainAsset,
  pickDirectionalAsset,
  type BranchAssetMeta,
} from './branchAssetMeta';
import { getNodeHeight } from './nodeMetrics';

const MIN_SCALE = 0.38;
const MAX_SCALE = 1.08;

interface SegmentPlacement {
  instance: BranchInstance;
  tipWorld: AttachmentPoint;
}

function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function lerpPoint(a: AttachmentPoint, b: AttachmentPoint, t: number): AttachmentPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function getParentAttachment(
  link: PositionedLink,
  leafAnchors: Map<number, LeafAnchor>,
): AttachmentPoint {
  const parent = link.source;

  if (parent.depth === 0) {
    const side = link.target.worldX < parent.worldX ? -1 : 1;
    return {
      x: trunkLayout.centerX + side * 42,
      y: trunkLayout.crownY,
    };
  }

  const anchor = leafAnchors.get(parent.id);
  if (anchor) {
    const h = getNodeHeight(parent.data);
    return { x: anchor.worldX, y: anchor.worldY - h / 2 + 4 };
  }

  const h = getNodeHeight(parent.data);
  return { x: parent.worldX, y: parent.worldY - h / 2 };
}

function getTargetPoint(link: PositionedLink): AttachmentPoint {
  const child = link.target;
  const h = getNodeHeight(child.data);
  return {
    x: child.worldX,
    y: child.worldY - h / 2 - 8,
  };
}

function placeBranchSegment(
  asset: BranchInstance['asset'],
  start: AttachmentPoint,
  end: AttachmentPoint,
  link: PositionedLink,
  segmentIndex: number,
  zIndex: number,
): SegmentPlacement {
  const meta = BRANCH_ASSET_META[asset];
  const desiredDx = end.x - start.x;
  const desiredDy = end.y - start.y;
  const desiredLen = Math.max(Math.hypot(desiredDx, desiredDy), 24);
  const desiredAngle = Math.atan2(desiredDy, desiredDx);

  const basePx = {
    x: meta.base.x * meta.nativeWidth,
    y: meta.base.y * meta.nativeHeight,
  };
  const tipPx = {
    x: meta.tip.x * meta.nativeWidth,
    y: meta.tip.y * meta.nativeHeight,
  };
  const imageAngle = Math.atan2(tipPx.y - basePx.y, tipPx.x - basePx.x);
  const rotation = deg(desiredAngle - imageAngle);

  const reach = nativeReach(meta);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, desiredLen / reach));
  const width = meta.nativeWidth * scale;
  const height = meta.nativeHeight * scale;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const bx = basePx.x * scale;
  const by = basePx.y * scale;
  const tx = tipPx.x * scale;
  const ty = tipPx.y * scale;

  const worldBx = start.x;
  const worldBy = start.y;
  const x = worldBx - (bx * cos - by * sin);
  const y = worldBy - (bx * sin + by * cos);

  const tipWorld = {
    x: x + (tx * cos - ty * sin),
    y: y + (tx * sin + ty * cos),
  };

  const instance: BranchInstance = {
    id: `branch-${link.source.id}-${link.target.id}-${segmentIndex}`,
    asset,
    x,
    y,
    width,
    height,
    rotation,
    flipX: false,
    parentPersonId: link.source.id,
    childPersonId: link.target.id,
    attachmentStart: { ...start },
    attachmentEnd: tipWorld,
    zIndex,
    generationDepth: link.target.depth,
    segmentIndex,
  };

  return { instance, tipWorld };
}

function placeHangingStem(
  start: AttachmentPoint,
  leafTop: AttachmentPoint,
  link: PositionedLink,
  zIndex: number,
): SegmentPlacement {
  return placeBranchSegment('hanging-stem', start, leafTop, link, 99, zIndex);
}

function buildChainForLink(
  link: PositionedLink,
  start: AttachmentPoint,
  target: AttachmentPoint,
  leafAnchors: Map<number, LeafAnchor>,
  zBase: number,
): { branches: BranchInstance[]; stemTip: AttachmentPoint } {
  const goesLeft = target.x < start.x;
  const parentDepth = link.source.depth;
  const totalDist = Math.hypot(target.x - start.x, target.y - start.y);

  const primary = pickDirectionalAsset(parentDepth, goesLeft);
  const primaryMeta = BRANCH_ASSET_META[primary];
  const branches: BranchInstance[] = [];

  let cursor = { ...start };
  let remaining = totalDist;
  let segmentIndex = 0;
  let tier = Math.min(parentDepth, 3);

  while (remaining > primaryMeta.maxReach * MAX_SCALE * 0.92 && segmentIndex < 4) {
    const partialEnd = lerpPoint(cursor, target, Math.min(0.55, primaryMeta.maxReach / totalDist));
    const asset = pickChainAsset(tier, goesLeft);
    const placed = placeBranchSegment(asset, cursor, partialEnd, link, segmentIndex, zBase + segmentIndex);
    branches.push(placed.instance);
    cursor = placed.tipWorld;
    remaining = Math.hypot(target.x - cursor.x, target.y - cursor.y);
    segmentIndex += 1;
    tier = Math.min(tier + 1, 3);
  }

  const finalAsset =
    segmentIndex === 0
      ? primary
      : pickChainAsset(Math.min(tier, 3), goesLeft);

  const finalPlacement = placeBranchSegment(
    finalAsset,
    cursor,
    target,
    link,
    segmentIndex,
    zBase + segmentIndex,
  );
  branches.push(finalPlacement.instance);

  const stemTop: AttachmentPoint = {
    x: target.x,
    y: target.y + 6,
  };
  const stem = placeHangingStem(
    finalPlacement.tipWorld,
    stemTop,
    link,
    zBase + segmentIndex + 1,
  );
  branches.push(stem.instance);

  const childH = getNodeHeight(link.target.data);
  const tiltDeg = deg(Math.atan2(target.x - start.x, -(target.y - start.y)));

  leafAnchors.set(link.target.id, {
    worldX: stem.tipWorld.x,
    worldY: stem.tipWorld.y + childH / 2 - 4,
    tiltDeg: Math.max(-32, Math.min(32, tiltDeg * 0.5)),
  });

  return { branches, stemTip: stem.tipWorld };
}

export function buildBranchInstances(layout: TreeLayoutResult): BranchCompositionResult {
  const leafAnchors = new Map<number, LeafAnchor>();
  const branches: BranchInstance[] = [];

  const sortedLinks = [...layout.links].sort(
    (a, b) => a.target.depth - b.target.depth || a.target.id - b.target.id,
  );

  sortedLinks.forEach((link, index) => {
    const start = getParentAttachment(link, leafAnchors);
    const target = getTargetPoint(link);
    const zBase = 20 + link.target.depth * 10 + index;

    const chain = buildChainForLink(link, start, target, leafAnchors, zBase);
    branches.push(...chain.branches);
  });

  layout.nodes.forEach((node) => {
    if (!leafAnchors.has(node.id)) {
      leafAnchors.set(node.id, {
        worldX: node.worldX,
        worldY: node.worldY,
        tiltDeg: 0,
      });
    }
  });

  branches.sort((a, b) => a.zIndex - b.zIndex);

  return { branches, leafAnchors };
}

export function getFoliagePointsAlongBranch(instance: BranchInstance): AttachmentPoint[] {
  const meta: BranchAssetMeta = BRANCH_ASSET_META[instance.asset];
  const points: AttachmentPoint[] = [];
  const steps = instance.asset === 'hanging-stem' ? 1 : 3;

  for (let i = 1; i <= steps; i += 1) {
    const t = i / (steps + 1);
    points.push(
      lerpPoint(instance.attachmentStart, instance.attachmentEnd, t),
    );
  }

  points.push(instance.attachmentEnd);
  void meta;
  return points;
}
