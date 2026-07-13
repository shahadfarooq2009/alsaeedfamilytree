import { getMemberFirstName } from '../normalizeFamilyData';
import { formatRelationLabel, type RelationMember } from '../formatRelationLabel';
import { MIN_CARD_GAP } from './cardBounds';
import { type LayoutStage } from './stageBounds';

const MIN_NAME_FONT_SIZE = 10;
const MIN_CARD_WIDTH = 48;

export type TreeDisplayMode =
  | 'full'
  | 'firstNameWithRelation'
  | 'firstName';

export interface TreeLayoutScale {
  memberCount: number;
  scale: number;
  tier: 1 | 2 | 3 | 4;
  displayMode: TreeDisplayMode;
  showRelationLabel: boolean;
  cardWidth: number;
  cardHeight: number;
  founderCardWidth: number;
  founderCardHeight: number;
  badgeSize: number;
  founderBadgeSize: number;
  badgeOverhang: number;
  founderBadgeOverhang: number;
  nameFontSize: number;
  founderNameFontSize: number;
  relationFontSize: number;
  borderRadius: number;
  founderBorderRadius: number;
  cardPaddingTop: number;
  founderPaddingTop: number;
  siblingGap: number;
  branchGap: number;
  familyGroupGap: number;
  generationGap: number;
  minGenerationGap: number;
  generationScale: number;
  founderChildGap: number;
  branchZonePadding: number;
  canvasPadding: number;
  connectorChildDrop: number;
  minBranchSeparation: number;
  connectorStrokeCore: number;
  connectorStrokeFocusCore: number;
  minCanvasWidth: number;
  minCanvasHeight: number;
}

/** Compact readable tiers — card width 72–90px range. */
const TIER_SIZES = {
  1: { cardWidth: 90, cardHeight: 56, badge: 24, font: 14 },
  2: { cardWidth: 82, cardHeight: 52, badge: 22, font: 12 },
  3: { cardWidth: 78, cardHeight: 48, badge: 20, font: 11 },
  4: { cardWidth: 72, cardHeight: 46, badge: 18, font: 10 },
} as const;

const COMPACT_GAPS = {
  sibling: 7,
  branch: 16,
  familyGroup: 22,
  generation: 80,
} as const;

function tierForCount(memberCount: number): 1 | 2 | 3 | 4 {
  if (memberCount <= 20) return 1;
  if (memberCount <= 40) return 2;
  if (memberCount <= 70) return 3;
  return 4;
}

function displayModeForTier(tier: 1 | 2 | 3 | 4): TreeDisplayMode {
  if (tier === 1) return 'full';
  if (tier === 2) return 'firstNameWithRelation';
  return 'firstName';
}

function scaled(base: number, factor: number): number {
  return Math.round(base * factor * 10) / 10;
}

function clampGap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Compute compact layout scale.
 * @param compactFactor 1 = default readable; lower shrinks cards/gaps for dense fit.
 */
export function computeTreeLayoutScale(
  memberCount: number,
  maxGeneration = 5,
  stage?: LayoutStage,
  maxClusterSize = 4,
  branchCount = 6,
  compactFactor = 1,
  maxFamilyGroups = 4,
): TreeLayoutScale {
  const count = Math.max(1, memberCount);
  const tier = tierForCount(count);
  const tierSizes = TIER_SIZES[tier];
  const factor = Math.max(0.82, Math.min(1, compactFactor));

  let cardWidth: number = tierSizes.cardWidth;
  let cardHeight: number = tierSizes.cardHeight;
  let badgeSize: number = tierSizes.badge;
  let nameFontSize: number = tierSizes.font;

  const siblingGap = clampGap(COMPACT_GAPS.sibling * factor, 6, 8);
  const branchGap = clampGap(COMPACT_GAPS.branch * factor, 14, 22);
  const familyGroupGap = clampGap(COMPACT_GAPS.familyGroup * factor, 18, 26);
  const generationGap = clampGap(
    COMPACT_GAPS.generation * factor,
    70,
    maxGeneration >= 5 && count > 70 ? 85 : 85,
  );

  let resolvedGenerationGap = generationGap;

  if (stage) {
    const padding = 28;
    const branches = Math.max(1, branchCount);
    const cluster = Math.max(1, maxClusterSize);
    const usableWidth = stage.width - padding * 2;
    const zoneWidth = (usableWidth - (branches - 1) * branchGap) / branches;
    const maxPerRow = Math.max(1, Math.floor((zoneWidth + siblingGap) / (cardWidth + siblingGap)));
    const rowsNeeded = Math.ceil(cluster / maxPerRow);
    const perRow = rowsNeeded > 1
      ? Math.ceil(cluster / 2)
      : cluster;
    const zoneFit = Math.floor((zoneWidth - (perRow - 1) * siblingGap) / perRow);

    if (zoneFit > 0 && zoneFit < cardWidth) {
      cardWidth = Math.max(MIN_CARD_WIDTH, zoneFit);
      cardHeight = Math.max(40, Math.round(cardWidth * (tierSizes.cardHeight / tierSizes.cardWidth)));
      badgeSize = Math.max(16, Math.round(tierSizes.badge * (cardWidth / tierSizes.cardWidth)));
      nameFontSize = Math.max(MIN_NAME_FONT_SIZE, Math.round(tierSizes.font * (cardWidth / tierSizes.cardWidth)));
    }

    const avgGroupWidth = Math.max(cardWidth, cardWidth * 2 + siblingGap);
    const groupsPerRow = Math.max(
      1,
      Math.floor((zoneWidth + familyGroupGap) / (avgGroupWidth + familyGroupGap)),
    );
    const familyRows = Math.ceil(Math.max(1, maxFamilyGroups) / groupsPerRow);
    const rowFootprint = cardHeight + badgeSize + MIN_CARD_GAP;
    const minGapForFamilyRows = familyRows * rowFootprint + MIN_CARD_GAP;
    resolvedGenerationGap = clampGap(
      Math.max(resolvedGenerationGap, minGapForFamilyRows),
      70,
      count > 70 ? 112 : 95,
    );
  } else {
    cardWidth = Math.max(MIN_CARD_WIDTH, Math.round(tierSizes.cardWidth * factor));
    cardHeight = Math.max(40, Math.round(tierSizes.cardHeight * factor));
    badgeSize = Math.max(16, Math.round(tierSizes.badge * factor));
    nameFontSize = Math.max(MIN_NAME_FONT_SIZE, Math.round(tierSizes.font * factor));
  }

  const displayMode = displayModeForTier(tier);
  const stageWidth = stage?.width ?? 1600;
  const stageHeight = stage?.height ?? 900;

  return {
    memberCount: count,
    scale: cardWidth / TIER_SIZES[1].cardWidth,
    tier,
    displayMode,
    showRelationLabel: tier <= 2,
    cardWidth,
    cardHeight,
    founderCardWidth: Math.min(96, Math.round(cardWidth * 1.08)),
    founderCardHeight: Math.min(72, Math.round(cardHeight * 1.08)),
    badgeSize,
    founderBadgeSize: Math.min(26, badgeSize + 2),
    badgeOverhang: Math.max(8, scaled(11, factor)),
    founderBadgeOverhang: Math.max(9, scaled(13, factor)),
    nameFontSize,
    founderNameFontSize: nameFontSize,
    relationFontSize: Math.max(MIN_NAME_FONT_SIZE, Math.round(nameFontSize * 0.85)),
    borderRadius: Math.max(8, scaled(12, factor)),
    founderBorderRadius: Math.max(10, scaled(14, factor)),
    cardPaddingTop: Math.max(8, scaled(14, factor)),
    founderPaddingTop: Math.max(10, scaled(16, factor)),
    siblingGap,
    branchGap,
    familyGroupGap,
    generationGap: resolvedGenerationGap,
    minGenerationGap: 75,
    generationScale: resolvedGenerationGap,
    founderChildGap: Math.max(72, Math.round(resolvedGenerationGap * 0.9)),
    branchZonePadding: 0,
    canvasPadding: 0,
    connectorChildDrop: 6,
    minBranchSeparation: siblingGap,
    connectorStrokeCore: Math.max(0.9, scaled(1.25, factor)),
    connectorStrokeFocusCore: Math.max(1.1, scaled(1.6, factor)),
    minCanvasWidth: stageWidth,
    minCanvasHeight: stageHeight,
  };
}

/** Required horizontal layout width for branch zones without overlap. */
export function computeRequiredLayoutWidth(
  branchCount: number,
  maxClusterSize: number,
  cardWidth: number,
  siblingGap: number,
  branchGap: number,
  padding: number,
): number {
  const branches = Math.max(1, branchCount);
  const cluster = Math.max(1, maxClusterSize);
  const zoneWidth = cluster * cardWidth + Math.max(0, cluster - 1) * siblingGap;
  return padding * 2 + branches * zoneWidth + Math.max(0, branches - 1) * branchGap;
}

function hasParentLink(member: {
  fatherId: number | null;
  motherId?: number | null;
}): boolean {
  return member.fatherId != null || member.motherId != null;
}

export function isFounderForDisplay(member: {
  fatherId: number | null;
  motherId?: number | null;
}): boolean {
  return !hasParentLink(member);
}

export interface CardDisplayText {
  label: string;
  relationLabel?: string;
  showRelation: boolean;
}

export function getCardDisplayText(
  member: RelationMember & { initial: string },
  layoutScale: TreeLayoutScale,
  members: RelationMember[],
): CardDisplayText {
  const founder = isFounderForDisplay(member);
  const relationLabel = formatRelationLabel(member, members);
  const firstName = getMemberFirstName(member.fullName);

  if (layoutScale.displayMode === 'firstName') {
    return { label: firstName, showRelation: false };
  }

  if (layoutScale.displayMode === 'firstNameWithRelation') {
    return {
      label: founder ? member.fullName : firstName,
      relationLabel,
      showRelation: layoutScale.showRelationLabel && !founder,
    };
  }

  return {
    label: member.fullName,
    relationLabel: founder ? undefined : relationLabel,
    showRelation: layoutScale.showRelationLabel && !founder,
  };
}

export function treeScaleCssVars(
  layoutScale: TreeLayoutScale,
): Record<string, string | number> {
  return {
    '--tree-scale': layoutScale.scale,
    '--tree-card-width': `${layoutScale.cardWidth}px`,
    '--tree-card-height': `${layoutScale.cardHeight}px`,
    '--tree-founder-width': `${layoutScale.founderCardWidth}px`,
    '--tree-founder-height': `${layoutScale.founderCardHeight}px`,
    '--tree-badge-size': `${layoutScale.badgeSize}px`,
    '--tree-founder-badge-size': `${layoutScale.founderBadgeSize}px`,
    '--tree-name-font': `${layoutScale.nameFontSize}px`,
    '--tree-founder-name-font': `${layoutScale.founderNameFontSize}px`,
    '--tree-relation-font': `${layoutScale.relationFontSize}px`,
    '--tree-border-radius': `${layoutScale.borderRadius}px`,
    '--tree-founder-border-radius': `${layoutScale.founderBorderRadius}px`,
    '--tree-connector-core': `${layoutScale.connectorStrokeCore}px`,
    '--tree-connector-focus-core': `${layoutScale.connectorStrokeFocusCore}px`,
  };
}
