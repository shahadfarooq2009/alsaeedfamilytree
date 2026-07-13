import { memberRenderBox } from './memberBoundingBox';
import {
  SAFE_PADDING_X,
  SAFE_PADDING_Y,
  SHADOW_PADDING,
} from './layoutConstants';
import type { BranchConnectorPath, PositionedMember } from './types';

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface VirtualCanvasLayout {
  members: PositionedMember[];
  connectors: BranchConnectorPath[];
  canvasWidth: number;
  canvasHeight: number;
  contentBounds: ContentBounds;
  shiftX: number;
  shiftY: number;
}

function connectorPathBounds(paths: BranchConnectorPath[]): ContentBounds | null {
  if (paths.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  paths.forEach((path) => {
    const nums = path.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]);
      maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]);
      maxY = Math.max(maxY, nums[i + 1]);
    }
  });

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Compute tight bounds for cards (incl. badge + footprint) and connector paths. */
export function computeFullContentBounds(
  members: PositionedMember[],
  connectors: BranchConnectorPath[] = [],
): ContentBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  members.forEach((member) => {
    const box = memberRenderBox(member);
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  });

  const connectorBounds = connectorPathBounds(connectors);
  if (connectorBounds) {
    minX = Math.min(minX, connectorBounds.minX);
    minY = Math.min(minY, connectorBounds.minY);
    maxX = Math.max(maxX, connectorBounds.maxX);
    maxY = Math.max(maxY, connectorBounds.maxY);
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return {
    minX: minX - SHADOW_PADDING,
    minY: minY - SHADOW_PADDING,
    maxX: maxX + SHADOW_PADDING,
    maxY: maxY + SHADOW_PADDING,
  };
}

export function shiftConnectorPaths(
  paths: BranchConnectorPath[],
  dx: number,
  dy: number,
): BranchConnectorPath[] {
  if (dx === 0 && dy === 0) return paths;

  return paths.map((path) => {
    let index = 0;
    const d = path.d.replace(/-?\d*\.?\d+/g, (match) => {
      const value = Number(match);
      const shifted = index % 2 === 0 ? value + dx : value + dy;
      index += 1;
      return String(Math.round(shifted));
    });
    return { ...path, d };
  });
}

/** Shift nodes and connectors into a padded virtual canvas — no negative coordinates. */
export function normalizeToVirtualCanvas(
  members: PositionedMember[],
  connectors: BranchConnectorPath[],
): VirtualCanvasLayout {
  if (members.length === 0) {
    return {
      members: [],
      connectors: [],
      canvasWidth: SAFE_PADDING_X * 2,
      canvasHeight: SAFE_PADDING_Y * 2,
      contentBounds: {
        minX: SAFE_PADDING_X,
        minY: SAFE_PADDING_Y,
        maxX: SAFE_PADDING_X,
        maxY: SAFE_PADDING_Y,
      },
      shiftX: 0,
      shiftY: 0,
    };
  }

  const rawBounds = computeFullContentBounds(members, connectors);
  const shiftX = SAFE_PADDING_X - rawBounds.minX;
  const shiftY = SAFE_PADDING_Y - rawBounds.minY;

  const shiftedMembers = members.map((member) => ({
    ...member,
    x: Math.round(member.x + shiftX),
    y: Math.round(member.y + shiftY),
  }));

  const shiftedConnectors = shiftConnectorPaths(connectors, shiftX, shiftY);
  const finalBounds = computeFullContentBounds(shiftedMembers, shiftedConnectors);

  const canvasWidth = Math.ceil(finalBounds.maxX + SAFE_PADDING_X);
  const canvasHeight = Math.ceil(finalBounds.maxY + SAFE_PADDING_Y);

  return {
    members: shiftedMembers,
    connectors: shiftedConnectors,
    canvasWidth,
    canvasHeight,
    contentBounds: finalBounds,
    shiftX,
    shiftY,
  };
}
