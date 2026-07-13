import type { BranchAssetType } from '../types/branchInstance';

export interface BranchAssetMeta {
  nativeWidth: number;
  nativeHeight: number;
  /** Normalized attachment base (0–1). */
  base: { x: number; y: number };
  /** Normalized branch tip (0–1). */
  tip: { x: number; y: number };
  /** Maximum world-pixel reach at scale 1.0. */
  maxReach: number;
}

export const BRANCH_ASSET_META: Record<BranchAssetType, BranchAssetMeta> = {
  'branch-main-left': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.9, y: 0.86 },
    tip: { x: 0.1, y: 0.18 },
    maxReach: 310,
  },
  'branch-main-right': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.1, y: 0.86 },
    tip: { x: 0.9, y: 0.18 },
    maxReach: 310,
  },
  'branch-medium-left': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.88, y: 0.84 },
    tip: { x: 0.12, y: 0.22 },
    maxReach: 240,
  },
  'branch-medium-right': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.12, y: 0.84 },
    tip: { x: 0.88, y: 0.22 },
    maxReach: 240,
  },
  'branch-small-left': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.86, y: 0.82 },
    tip: { x: 0.14, y: 0.26 },
    maxReach: 175,
  },
  'branch-small-right': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.14, y: 0.82 },
    tip: { x: 0.86, y: 0.26 },
    maxReach: 175,
  },
  'twig-left': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.84, y: 0.8 },
    tip: { x: 0.16, y: 0.28 },
    maxReach: 120,
  },
  'twig-right': {
    nativeWidth: 1536,
    nativeHeight: 1024,
    base: { x: 0.16, y: 0.8 },
    tip: { x: 0.84, y: 0.28 },
    maxReach: 120,
  },
  'hanging-stem': {
    nativeWidth: 1024,
    nativeHeight: 1536,
    base: { x: 0.5, y: 0.9 },
    tip: { x: 0.5, y: 0.12 },
    maxReach: 95,
  },
};

const SEGMENT_CHAIN: BranchAssetType[][] = [
  ['branch-main-left', 'branch-main-right'],
  ['branch-medium-left', 'branch-medium-right'],
  ['branch-small-left', 'branch-small-right'],
  ['twig-left', 'twig-right'],
];

export function pickDirectionalAsset(
  parentDepth: number,
  goesLeft: boolean,
): BranchAssetType {
  if (parentDepth === 0) {
    return goesLeft ? 'branch-main-left' : 'branch-main-right';
  }

  if (parentDepth === 1) {
    return goesLeft ? 'branch-medium-left' : 'branch-medium-right';
  }

  if (parentDepth === 2) {
    return goesLeft ? 'branch-small-left' : 'branch-small-right';
  }

  return goesLeft ? 'twig-left' : 'twig-right';
}

export function pickChainAsset(
  tier: number,
  goesLeft: boolean,
): BranchAssetType {
  const pair = SEGMENT_CHAIN[Math.min(tier, SEGMENT_CHAIN.length - 1)];
  return goesLeft ? pair[0] : pair[1];
}

export function nativeReach(meta: BranchAssetMeta): number {
  const bx = meta.base.x * meta.nativeWidth;
  const by = meta.base.y * meta.nativeHeight;
  const tx = meta.tip.x * meta.nativeWidth;
  const ty = meta.tip.y * meta.nativeHeight;
  return Math.hypot(tx - bx, ty - by);
}
