/** Distinct branch accent colors for the Family Forest view. */
export const FOREST_BRANCH_COLORS = [
  '#2d6a4f',
  '#1d4e89',
  '#9b2226',
  '#7b2cbf',
  '#bc6c25',
  '#0077b6',
  '#6a994e',
  '#e76f51',
  '#5a189a',
  '#40916c',
  '#d62828',
  '#f77f00',
] as const;

/** Panel rectangle tints — one per gen-2 branch column. */
export const FOREST_PANEL_COLORS = [
  '#5b8a6a',
  '#4a6fa5',
  '#c17b5c',
  '#8b6bae',
  '#6b8f71',
] as const;

export interface ForestBranchHeadTheme {
  bgTop: string;
  bgBottom: string;
  shadow: string;
  badge: string;
  border: string;
}

/** Unified gen-2 branch head palette — slate-blue cards (reference forest row). */
export const FOREST_BRANCH_HEAD_THEME: ForestBranchHeadTheme = {
  bgTop: '#6a9ec4',
  bgBottom: '#2e4f68',
  shadow: 'rgba(18, 38, 58, 0.38)',
  badge: '#9ec8e8',
  border: 'rgba(255, 255, 255, 0.3)',
};

export const FOREST_BRANCH_HEAD_COLOR = '#2e4f68';

export function getForestBranchColor(branchIndex: number): string {
  return FOREST_BRANCH_COLORS[branchIndex % FOREST_BRANCH_COLORS.length];
}

export function getForestPanelColor(columnIndex: number): string {
  return FOREST_PANEL_COLORS[columnIndex % FOREST_PANEL_COLORS.length];
}

export function getForestBranchHeadThemeStyle(): Record<string, string> {
  return {
    '--gen-bg-top': FOREST_BRANCH_HEAD_THEME.bgTop,
    '--gen-bg-bottom': FOREST_BRANCH_HEAD_THEME.bgBottom,
    '--gen-shadow': FOREST_BRANCH_HEAD_THEME.shadow,
    '--gen-badge': FOREST_BRANCH_HEAD_THEME.badge,
    '--gen-border': FOREST_BRANCH_HEAD_THEME.border,
  };
}
