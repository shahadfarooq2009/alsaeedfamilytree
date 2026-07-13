export type ForestColumnPreset = 'mobile' | 'tablet' | 'desktop';
export type ForestCardTier = 'root' | 'branch-head' | 'standard' | 'compact' | 'micro' | 'gen3-grid';

export interface ForestViewportSpec {
  preset: ForestColumnPreset;
  columnCount: number;
  viewportWidth: number;
  padding: number;
  columnGap: number;
  panelPadding: number;
  /** Short vertical line from founder card bottom to the horizontal rail. */
  founderStemHeight: number;
  founderConnectorHeight: number;
  rootCardWidth: number;
  rootCardHeight: number;
  branchHeadWidth: number;
  branchHeadHeight: number;
  cardWidth: number;
  cardHeight: number;
  compactCardWidth: number;
  compactCardHeight: number;
  rowGap: number;
  generationGap: number;
  inlineCardWidth: number;
  inlineCardHeight: number;
  expandIconSize: number;
  branchFooterHeight: number;
  branchFooterGap: number;
}

/** Maximum gen-2 branch columns on wide screens. */
export const FOREST_MAX_GEN2_COLUMNS = 5;

export function getForestViewportMaxColumns(viewportWidth: number): number {
  if (viewportWidth < 640) return 1;
  if (viewportWidth < 1024) return 2;
  return FOREST_MAX_GEN2_COLUMNS;
}

/** @deprecated Use resolveForestColumnCount */
export function getForestColumnCount(viewportWidth: number): number {
  return getForestViewportMaxColumns(viewportWidth);
}

export function resolveForestColumnCount(
  screenWidth: number,
  gen2BranchCount: number,
): number {
  const maxColumns = getForestViewportMaxColumns(screenWidth);
  const branches = Math.max(1, gen2BranchCount);
  return Math.min(branches, maxColumns);
}

/** Narrower layout width so the forest map sits centered with side margins. */
export function getForestMapCenterX(layoutWidth: number, zoom: number): number {
  return Math.round((layoutWidth * (1 - zoom)) / 2);
}

export function getForestLayoutWidth(screenWidth: number, columnCount?: number): number {
  const width = Math.max(320, Math.round(screenWidth));
  const columns = columnCount ?? getForestViewportMaxColumns(width);

  if (columns >= 5) {
    return Math.min(1080, Math.max(860, Math.round(width * 0.88)));
  }

  if (columns === 4) {
    return Math.min(880, Math.max(640, Math.round(width * 0.68)));
  }

  if (columns === 2) {
    return Math.min(width, Math.max(520, Math.round(width * 0.84)));
  }

  return width;
}

export function getForestViewportSpec(
  screenWidth: number,
  gen2BranchCount = 4,
): ForestViewportSpec {
  const columnCount = resolveForestColumnCount(screenWidth, gen2BranchCount);
  const layoutWidth = getForestLayoutWidth(screenWidth, columnCount);

  if (columnCount === 1) {
    return {
      preset: 'mobile',
      columnCount,
      viewportWidth: layoutWidth,
      padding: 12,
      columnGap: 10,
      panelPadding: 12,
      founderStemHeight: 14,
      founderConnectorHeight: 32,
      rootCardWidth: 142,
      rootCardHeight: 186,
      branchHeadWidth: 84,
      branchHeadHeight: 96,
      cardWidth: 86,
      cardHeight: 58,
      compactCardWidth: 72,
      compactCardHeight: 44,
      rowGap: 6,
      generationGap: 18,
      inlineCardWidth: 64,
      inlineCardHeight: 38,
      expandIconSize: 20,
      branchFooterHeight: 28,
      branchFooterGap: 14,
    };
  }

  if (columnCount === 2) {
    return {
      preset: 'tablet',
      columnCount,
      viewportWidth: layoutWidth,
      padding: 16,
      columnGap: 14,
      panelPadding: 12,
      founderStemHeight: 14,
      founderConnectorHeight: 36,
      rootCardWidth: 150,
      rootCardHeight: 192,
      branchHeadWidth: 88,
      branchHeadHeight: 98,
      cardWidth: 92,
      cardHeight: 62,
      compactCardWidth: 76,
      compactCardHeight: 48,
      rowGap: 7,
      generationGap: 20,
      inlineCardWidth: 68,
      inlineCardHeight: 40,
      expandIconSize: 22,
      branchFooterHeight: 30,
      branchFooterGap: 14,
    };
  }

  if (columnCount >= 5) {
    return {
      preset: 'desktop',
      columnCount,
      viewportWidth: layoutWidth,
      padding: 14,
      columnGap: 12,
      panelPadding: 10,
      founderStemHeight: 14,
      founderConnectorHeight: 34,
      rootCardWidth: 138,
      rootCardHeight: 182,
      branchHeadWidth: 78,
      branchHeadHeight: 94,
      cardWidth: 76,
      cardHeight: 52,
      compactCardWidth: 64,
      compactCardHeight: 40,
      rowGap: 8,
      generationGap: 18,
      inlineCardWidth: 56,
      inlineCardHeight: 34,
      expandIconSize: 18,
      branchFooterHeight: 30,
      branchFooterGap: 16,
    };
  }

  return {
    preset: 'desktop',
    columnCount,
    viewportWidth: layoutWidth,
    padding: 16,
    columnGap: 12,
    panelPadding: 12,
    founderStemHeight: 14,
    founderConnectorHeight: 34,
    rootCardWidth: 146,
    rootCardHeight: 190,
    branchHeadWidth: 82,
    branchHeadHeight: 96,
    cardWidth: 82,
    cardHeight: 54,
    compactCardWidth: 68,
    compactCardHeight: 42,
    rowGap: 6,
    generationGap: 18,
    inlineCardWidth: 60,
    inlineCardHeight: 36,
    expandIconSize: 20,
    branchFooterHeight: 28,
    branchFooterGap: 16,
  };
}

export function getForestColumnWidth(spec: ForestViewportSpec): number {
  const usable = spec.viewportWidth - spec.padding * 2 - spec.columnGap * (spec.columnCount - 1);
  return Math.floor(usable / spec.columnCount);
}

export function getCardSizeForTier(
  tier: ForestCardTier,
  spec: ForestViewportSpec,
): { width: number; height: number } {
  switch (tier) {
    case 'root':
      return { width: spec.rootCardWidth, height: spec.rootCardHeight };
    case 'branch-head':
      return { width: spec.branchHeadWidth, height: spec.branchHeadHeight };
    case 'standard':
      return { width: spec.cardWidth, height: spec.cardHeight };
    case 'compact':
      return { width: spec.compactCardWidth, height: spec.compactCardHeight };
    case 'micro':
      return { width: spec.inlineCardWidth, height: spec.inlineCardHeight };
    case 'gen3-grid': {
      const size = getGen3GridCardSize(getForestColumnWidth(spec), spec);
      return { width: size.width, height: size.height };
    }
    default:
      return { width: spec.cardWidth, height: spec.cardHeight };
  }
}

export function getTierForDepth(depth: number): ForestCardTier {
  if (depth <= 0) return 'branch-head';
  if (depth === 1) return 'standard';
  if (depth === 2) return 'compact';
  return 'micro';
}

export function forestExpandIconId(parentId: number): string {
  return `forest-expand-${parentId}`;
}

/** Initial forest view: show up to this many descendant cards per branch panel. */
export const FOREST_INITIAL_DESCENDANTS_PER_BRANCH = 11;

/** Grid columns for descendant cards inside each branch panel. */
export const FOREST_INITIAL_GRID_COLUMNS = 3;

/** Uniform gen-3 card size that fits inside a branch panel with gaps. */
export function getGen3GridCardSize(
  columnWidth: number,
  spec: ForestViewportSpec,
): { width: number; height: number; gap: number } {
  const gap = Math.max(8, spec.rowGap + 3);
  const usable = columnWidth - spec.panelPadding * 2;
  const columns = FOREST_INITIAL_GRID_COLUMNS;
  const width = Math.floor((usable - gap * (columns - 1)) / columns);
  const cardWidth = Math.max(44, width);
  const cardHeight = Math.max(50, Math.round(cardWidth * 0.86));

  return { width: cardWidth, height: cardHeight, gap };
}

function getTierForGridIndex(index: number): ForestCardTier {
  if (index < 3) return 'standard';
  if (index < 7) return 'compact';
  return 'micro';
}

export { getTierForGridIndex };
