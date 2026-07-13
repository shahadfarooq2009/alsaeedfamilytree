const GENERATION_THEME_COUNT = 8;

export function getGenerationThemeClass(generation: number): string {
  const safeGeneration = Number.isFinite(generation) && generation > 0 ? generation : 1;
  const index = ((safeGeneration - 1) % GENERATION_THEME_COUNT) + 1;
  return `g${index}`;
}

/** CSS custom properties for elevated generation cards (shared palette). */
export function getGenerationThemeStyle(generation: number): Record<string, string> {
  const palette = GENERATION_PALETTE[
    ((Number.isFinite(generation) && generation > 0 ? generation : 1) - 1) % GENERATION_THEME_COUNT
  ];
  return {
    '--gen-bg-top': palette.bgTop,
    '--gen-bg-bottom': palette.bgBottom,
    '--gen-shadow': palette.shadow,
    '--gen-badge': palette.badge,
    '--gen-border': palette.border,
  };
}

export const GENERATION_PALETTE = [
  { bgTop: '#a68a4a', bgBottom: '#7a6230', shadow: 'rgba(74, 58, 24, 0.3)', badge: '#e8c878', border: 'rgba(255, 255, 255, 0.24)' },
  { bgTop: '#6f8161', bgBottom: '#4a5836', shadow: 'rgba(30, 40, 22, 0.3)', badge: '#9eb88a', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#7d9468', bgBottom: '#556848', shadow: 'rgba(36, 48, 28, 0.3)', badge: '#b8d0a4', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#8f8458', bgBottom: '#625a38', shadow: 'rgba(58, 52, 30, 0.3)', badge: '#d4c48a', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#9a7050', bgBottom: '#6e4e34', shadow: 'rgba(68, 42, 26, 0.3)', badge: '#d4a882', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#667657', bgBottom: '#424d38', shadow: 'rgba(28, 36, 22, 0.3)', badge: '#9eb08e', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#5f8578', bgBottom: '#3d5c54', shadow: 'rgba(24, 44, 38, 0.3)', badge: '#8eb8a6', border: 'rgba(255, 255, 255, 0.22)' },
  { bgTop: '#7a6e5c', bgBottom: '#524838', shadow: 'rgba(48, 40, 30, 0.3)', badge: '#c4b49a', border: 'rgba(255, 255, 255, 0.22)' },
] as const;
