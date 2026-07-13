import { getMemberFirstName } from '../normalizeFamilyData';
import { formatRelationLabel, type RelationMember } from '../formatRelationLabel';
import {
  clampBadgeSize,
  clampCardHeight,
  clampCardWidth,
  clampFontSize,
  GENERATION_GAP,
  MAIN_BRANCH_GAP,
  SIBLING_GAP,
} from './layoutConstants';

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

const BASE = {
  cardWidth: 96,
  cardHeight: 66,
  founderCardWidth: 110,
  founderCardHeight: 72,
  badgeSize: 24,
  founderBadgeSize: 26,
  badgeOverhang: 11,
  founderBadgeOverhang: 13,
  nameFontSize: 14,
  borderRadius: 12,
  founderBorderRadius: 14,
  cardPaddingTop: 14,
  founderPaddingTop: 16,
  siblingGap: 18,
  branchGap: 52,
  generationGap: 86,
  founderChildGap: 132,
  branchZonePadding: 14,
  canvasPadding: 56,
  connectorStrokeCore: 1.25,
  connectorStrokeFocusCore: 1.6,
  minCanvasWidth: 2800,
  minCanvasHeight: 1100,
} as const;

/** User tiers: <=20 large, <=40 medium, <=70 smaller, >70 compact. */
const TIER_SIZES = {
  1: { cardWidth: 88, cardHeight: 72, badge: 26, font: 16 },
  2: { cardWidth: 76, cardHeight: 64, badge: 24, font: 14 },
  3: { cardWidth: 64, cardHeight: 56, badge: 22, font: 12 },
  4: { cardWidth: 52, cardHeight: 46, badge: 20, font: 10 },
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

/** Compute responsive layout scale from member count and available stage area. */
export function computeTreeLayoutScale(options: {
  memberCount: number;
  maxGeneration?: number;
  stageWidth?: number;
  stageHeight?: number;
  maxChildrenPerRow?: number;
  maxMembersAtDepth?: number;
  leafCount?: number;
  branchCount?: number;
}): TreeLayoutScale {
  const count = Math.max(1, options.memberCount);
  const stageWidth = options.stageWidth ?? 1600;
  const stageHeight = options.stageHeight ?? 900;
  void options.maxChildrenPerRow;
  const branchCount = Math.max(1, options.branchCount ?? 6);
  void options.leafCount;
  void options.stageWidth;
  void branchCount;

  const tier = tierForCount(count);
  const sizes = TIER_SIZES[tier];
  let cardWidth = clampCardWidth(sizes.cardWidth);
  let cardHeight = clampCardHeight(sizes.cardHeight);

  const paddingY = Math.max(24, Math.round(stageHeight * 0.035));
  const usableHeight = stageHeight - paddingY * 2;
  const minGap = 10;
  const generationRows = Math.max(1, options.maxGeneration ?? 5);
  const footprint = cardHeight + sizes.badge * 0.45;
  const verticalNeed = generationRows * (footprint + minGap);

  if (verticalNeed > usableHeight) {
    const shrink = Math.max(0.85, usableHeight / verticalNeed);
    cardWidth = clampCardWidth(Math.round(cardWidth * shrink));
    cardHeight = clampCardHeight(Math.round(cardHeight * shrink));
  }

  const factor = cardWidth / TIER_SIZES[1].cardWidth;
  const displayMode = displayModeForTier(tier);
  const generationGap = GENERATION_GAP;

  return {
    memberCount: count,
    scale: factor,
    tier,
    displayMode,
    showRelationLabel: tier <= 2,
    cardWidth,
    cardHeight,
    founderCardWidth: clampCardWidth(Math.round(cardWidth * 1.1)),
    founderCardHeight: clampCardHeight(Math.round(cardHeight * 1.1)),
    badgeSize: clampBadgeSize(sizes.badge, cardWidth),
    founderBadgeSize: clampBadgeSize(Math.min(26, sizes.badge + 2), clampCardWidth(Math.round(cardWidth * 1.1))),
    badgeOverhang: Math.max(9, scaled(BASE.badgeOverhang, factor)),
    founderBadgeOverhang: Math.max(10, scaled(BASE.founderBadgeOverhang, factor)),
    nameFontSize: clampFontSize(sizes.font),
    founderNameFontSize: clampFontSize(sizes.font),
    relationFontSize: Math.max(9, Math.round(sizes.font * 0.82)),
    borderRadius: Math.max(8, scaled(BASE.borderRadius, factor)),
    founderBorderRadius: Math.max(10, scaled(BASE.founderBorderRadius, factor)),
    cardPaddingTop: Math.max(8, scaled(BASE.cardPaddingTop, factor)),
    founderPaddingTop: Math.max(10, scaled(BASE.founderPaddingTop, factor)),
    siblingGap: SIBLING_GAP,
    branchGap: MAIN_BRANCH_GAP,
    generationGap,
    minGenerationGap: GENERATION_GAP,
    generationScale: generationGap,
    founderChildGap: Math.max(88, scaled(BASE.founderChildGap, factor)),
    branchZonePadding: Math.max(7, scaled(BASE.branchZonePadding, factor)),
    canvasPadding: Math.max(36, scaled(BASE.canvasPadding, factor)),
    connectorChildDrop: 6,
    minBranchSeparation: 10,
    connectorStrokeCore: Math.max(0.9, scaled(BASE.connectorStrokeCore, factor)),
    connectorStrokeFocusCore: Math.max(1.1, scaled(BASE.connectorStrokeFocusCore, factor)),
    minCanvasWidth: stageWidth,
    minCanvasHeight: stageHeight,
  };
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
