import type { TreePersonNode } from '../../../types/tree';
import {
  TRUNK_ASPECT,
  TRUNK_WIDTH_FRAC,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../../../utils/nodeMetrics';

import trunkImage from '../../../assets/family-tree/processed/tree-trunk.png.png';
import foliageClusters from '../../../assets/family-tree/processed/foliage-clusters.png.png';
import leafGen1 from '../../../assets/family-tree/processed/member-leaf-gen-1.png.png';
import leafGen2 from '../../../assets/family-tree/processed/member-leaf-gen-2.png.png';
import leafGen3 from '../../../assets/family-tree/processed/member-leaf-gen-3.png.png';
import leafGen4 from '../../../assets/family-tree/processed/member-leaf-gen-4.png.png';
import leafGen5 from '../../../assets/family-tree/processed/member-leaf-gen-5.png.png';
import leafSelected from '../../../assets/family-tree/processed/member-leaf-selected.png.png';
import branchMainLeft from '../../../assets/family-tree/processed/branches/branch-main-left.png';
import branchMainRight from '../../../assets/family-tree/processed/branches/branch-main-right.png';
import branchMediumLeft from '../../../assets/family-tree/processed/branches/branch-medium-left.png';
import branchMediumRight from '../../../assets/family-tree/processed/branches/branch-medium-right.png';
import branchSmallLeft from '../../../assets/family-tree/processed/branches/branch-small-left.png';
import branchSmallRight from '../../../assets/family-tree/processed/branches/branch-small-right.png';
import twigLeft from '../../../assets/family-tree/processed/branches/twig-left.png';
import twigRight from '../../../assets/family-tree/processed/branches/twig-right.png';
import hangingStem from '../../../assets/family-tree/processed/branches/hanging-stem.png';
import type { BranchAssetType } from '../../../types/branchInstance';

/** Native pixel size of all approved square assets. */
export const ASSET_NATIVE_SIZE = 1254;

export const treeAssets = {
  trunk: trunkImage,
  foliageClusters,
  branches: {
    'branch-main-left': branchMainLeft,
    'branch-main-right': branchMainRight,
    'branch-medium-left': branchMediumLeft,
    'branch-medium-right': branchMediumRight,
    'branch-small-left': branchSmallLeft,
    'branch-small-right': branchSmallRight,
    'twig-left': twigLeft,
    'twig-right': twigRight,
    'hanging-stem': hangingStem,
  } satisfies Record<BranchAssetType, string>,
  leaves: {
    generation1: leafGen1,
    generation2: leafGen2,
    generation3: leafGen3,
    generation4: leafGen4,
    generation5: leafGen5,
    selected: leafSelected,
  },
} as const;

/** Approved generation → leaf image mapping. */
export function getLeafAssetUrl(
  person: Pick<TreePersonNode, 'generation_number' | 'is_family_head'>,
  isActive: boolean,
): string {
  if (isActive) {
    return treeAssets.leaves.selected;
  }

  const generation = person.generation_number;

  if (generation === 0 || person.is_family_head) {
    return treeAssets.leaves.generation5;
  }

  if (generation === 1) {
    return treeAssets.leaves.generation1;
  }

  if (generation === 2) {
    return treeAssets.leaves.generation2;
  }

  if (generation === 3) {
    return treeAssets.leaves.generation3;
  }

  if (generation === 4) {
    return treeAssets.leaves.generation4;
  }

  return treeAssets.leaves.generation5;
}

export interface LeafTextLayout {
  avatarY: number;
  nameY: number;
  metaY: number;
  nameFontSize: number;
  metaFontSize: number;
  nameMaxChars: number;
  showFounderLabel: boolean;
}

export function getLeafTextLayout(
  generation: number,
  isFounder: boolean,
): LeafTextLayout {
  if (isFounder || generation === 0) {
    return {
      avatarY: 0.24,
      nameY: 0.5,
      metaY: 0.86,
      nameFontSize: 12,
      metaFontSize: 9.5,
      nameMaxChars: 16,
      showFounderLabel: true,
    };
  }

  if (generation === 1) {
    return {
      avatarY: 0.22,
      nameY: 0.5,
      metaY: 0.86,
      nameFontSize: 11.5,
      metaFontSize: 9,
      nameMaxChars: 14,
      showFounderLabel: false,
    };
  }

  if (generation === 2) {
    return {
      avatarY: 0.21,
      nameY: 0.5,
      metaY: 0.85,
      nameFontSize: 11,
      metaFontSize: 9,
      nameMaxChars: 13,
      showFounderLabel: false,
    };
  }

  return {
    avatarY: 0.2,
    nameY: 0.5,
    metaY: 0.84,
    nameFontSize: 10.5,
    metaFontSize: 8.5,
    nameMaxChars: 12,
    showFounderLabel: false,
  };
}

/** Trunk image placement in world coordinates (bottom-center anchor). */
export const trunkLayout = {
  width: WORLD_WIDTH * TRUNK_WIDTH_FRAC,
  get height() {
    return this.width * TRUNK_ASPECT;
  },
  centerX: WORLD_WIDTH / 2,
  bottomY: WORLD_HEIGHT,
  get x() {
    return this.centerX - this.width / 2;
  },
  get y() {
    return this.bottomY - this.height;
  },
  get crownY() {
    return this.y + this.height * (1 - 0.58);
  },
} as const;

export const branchVisual = {
  stroke: '#6b5644',
  strokeLight: '#7a6550',
  strokeOlive: '#6a7558',
  highlight: '#9a8874',
  highlightSoft: '#8a7868',
  shadow: 'rgba(42, 34, 26, 0.2)',
} as const;
