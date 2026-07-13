import { type LayoutStage } from './stageBounds';

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

/** Reference card sizes — must match FamilyTreeFlow.css rendered cards. */
export const REFERENCE_CARD_SIZES = {
  founder: { width: 168, height: 118 },
  generation1: { width: 152, height: 108 },
  generation2: { width: 152, height: 108 },
  generation3: { width: 152, height: 108 },
  default: { width: 152, height: 108 },
} as const;

export const REFERENCE_GAPS = {
  sibling: 20,
  branch: 44,
  familyGroup: 28,
  generation: 148,
  founderChild: 360,
} as const;

export function computeTreeLayoutScale(
  memberCount: number,
  _maxGeneration = 5,
  stage?: LayoutStage,
  _maxClusterSize = 4,
  _branchCount = 6,
  _compactFactor = 1,
  _maxFamilyGroups = 4,
): TreeLayoutScale {
  const count = Math.max(1, memberCount);
  const tier = 1 as const;
  const stageWidth = stage?.width ?? 1600;
  const stageHeight = stage?.height ?? 900;
  const usableHeight = stageHeight * 0.8;
  const generationGap = Math.max(
    88,
    Math.min(
      REFERENCE_GAPS.generation,
      Math.round(usableHeight / Math.max(4, _maxGeneration)),
    ),
  );

  return {
    memberCount: count,
    scale: 1,
    tier,
    displayMode: 'full',
    showRelationLabel: false,
    cardWidth: REFERENCE_CARD_SIZES.generation2.width,
    cardHeight: REFERENCE_CARD_SIZES.generation2.height,
    founderCardWidth: REFERENCE_CARD_SIZES.founder.width,
    founderCardHeight: REFERENCE_CARD_SIZES.founder.height,
    badgeSize: 24,
    founderBadgeSize: 32,
    badgeOverhang: 14,
    founderBadgeOverhang: 16,
    nameFontSize: 12,
    founderNameFontSize: 15,
    relationFontSize: 10,
    borderRadius: 12,
    founderBorderRadius: 0,
    cardPaddingTop: 18,
    founderPaddingTop: 22,
    siblingGap: REFERENCE_GAPS.sibling,
    branchGap: REFERENCE_GAPS.branch,
    familyGroupGap: REFERENCE_GAPS.familyGroup,
    generationGap,
    minGenerationGap: 88,
    generationScale: generationGap,
    founderChildGap: REFERENCE_GAPS.founderChild,
    branchZonePadding: 0,
    canvasPadding: 0,
    connectorChildDrop: 8,
    minBranchSeparation: REFERENCE_GAPS.sibling,
    connectorStrokeCore: 1.35,
    connectorStrokeFocusCore: 1.8,
    minCanvasWidth: stageWidth,
    minCanvasHeight: stageHeight,
  };
}

export function isFounderForDisplay(member: {
  fatherId: number | null;
  motherId?: number | null;
}): boolean {
  return member.fatherId == null && member.motherId == null;
}

export interface CardDisplayText {
  label: string;
  relationLabel?: string;
  showRelation: boolean;
}

export function getCardDisplayText(
  member: { fullName: string; fatherId: number | null; motherId?: number | null },
  _layoutScale: TreeLayoutScale,
  _members: Array<{ fullName: string }>,
): CardDisplayText {
  const trimmed = member.fullName.trim();
  return { label: trimmed, showRelation: false };
}

export function getGenerationLabel(member: {
  fatherId: number | null;
  motherId?: number | null;
  generation: number;
}): string {
  if (isFounderForDisplay(member)) {
    return 'الجيل 0';
  }
  return `الجيل ${Math.max(1, member.generation)}`;
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
