import { mergeBounds, measureMembersBounds } from './cardBounds';
import { shiftMembers } from './branchZoneLayout';
import { generateBranchPathsFromLayout } from './generateBranchPath';
import type { BoundsRect } from './fitToViewport';
import type { LayoutStage } from './stageBounds';
import type { BranchConnectorPath, LayoutTreeNode, PositionedMember } from './types';

export const INTERNAL_MAP_PADDING = 56;
export const CONNECTOR_BOUNDS_PADDING = 4;

function emptyBounds(): BoundsRect {
  return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/** Parse orthogonal SVG path coordinates (M/L segments). */
export function parseSvgPathBounds(d: string, padding = 0): BoundsRect {
  const numbers = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (numbers.length < 2) return emptyBounds();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX)) return emptyBounds();

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

export function measureConnectorsBounds(
  connectors: BranchConnectorPath[],
  padding = CONNECTOR_BOUNDS_PADDING,
): BoundsRect {
  if (connectors.length === 0) return emptyBounds();

  return connectors.reduce<BoundsRect>((combined, connector) => {
    const pathBounds = parseSvgPathBounds(connector.d, padding);
    if (combined.maxX <= combined.minX) return pathBounds;
    return mergeBounds(combined, pathBounds);
  }, emptyBounds());
}

export function measureFullLayoutBounds(
  members: PositionedMember[],
  connectors: BranchConnectorPath[],
): BoundsRect {
  const memberBounds = measureMembersBounds(members);
  const connectorBounds = measureConnectorsBounds(connectors);

  if (memberBounds.maxX <= memberBounds.minX && memberBounds.maxY <= memberBounds.minY) {
    return connectorBounds;
  }
  if (connectorBounds.maxX <= connectorBounds.minX && connectorBounds.maxY <= connectorBounds.minY) {
    return memberBounds;
  }

  return mergeBounds(memberBounds, connectorBounds);
}

export function expandInternalMapCanvas(
  roots: LayoutTreeNode[],
  members: PositionedMember[],
  connectors: BranchConnectorPath[],
  stage: LayoutStage,
  padding = INTERNAL_MAP_PADDING,
): {
  members: PositionedMember[];
  connectors: BranchConnectorPath[];
  canvasWidth: number;
  canvasHeight: number;
  contentBounds: BoundsRect;
} {
  if (members.length === 0) {
    return {
      members,
      connectors,
      canvasWidth: stage.width,
      canvasHeight: stage.height,
      contentBounds: emptyBounds(),
    };
  }

  let resolved = members.map((member) => ({ ...member }));
  let paths = connectors;
  let bounds = measureFullLayoutBounds(resolved, paths);

  const dx = padding - bounds.minX;
  const dy = padding - bounds.minY;
  if (dx !== 0 || dy !== 0) {
    resolved = shiftMembers(resolved, dx, dy);
    paths = generateBranchPathsFromLayout(roots, resolved);
    bounds = measureFullLayoutBounds(resolved, paths);
  }

  const canvasWidth = Math.max(stage.width, Math.ceil(bounds.maxX + padding));
  const canvasHeight = Math.max(stage.height, Math.ceil(bounds.maxY + padding));

  return {
    members: resolved,
    connectors: paths,
    canvasWidth,
    canvasHeight,
    contentBounds: bounds,
  };
}
