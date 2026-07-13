export const botanicalTheme = {
  colors: {
    canvasBg: '#f6f3ec',
    canvasBgMid: '#f0ebe2',
    canvasBgEnd: '#e6e0d4',
    horizonWater: '#d8ddd2',
    mist: 'rgba(250, 248, 242, 0.62)',
    mountain: '#c5c9bc',
    mountainDeep: '#a8ada0',
    trunkDark: '#5a4638',
    trunkMid: '#7a5f4d',
    trunkLight: '#9a7d66',
    branch: '#6f5a47',
    branchOlive: '#5f6b4a',
    branchGold: '#c4a24e',
    gold: '#c9a227',
    goldSoft: '#e8d48b',
    ivory: '#f7f5ef',
    olive: '#3d4a2c',
    sage: '#8fa67a',
    textPrimary: '#2f3628',
    textMuted: '#5c6652',
    glass: 'rgba(255, 255, 255, 0.78)',
    glassBorder: 'rgba(201, 162, 39, 0.18)',
    drawerBg: '#faf7f0',
    drawerBorder: 'rgba(201, 162, 39, 0.35)',
  },
  shadows: {
    branch: 'drop-shadow(0px 2px 3px rgba(58, 46, 34, 0.22))',
    leaf: 'drop-shadow(0px 4px 10px rgba(47, 54, 40, 0.16))',
    leafHover: 'drop-shadow(0px 8px 16px rgba(47, 54, 40, 0.22))',
    leafSelected: 'drop-shadow(0px 0px 22px rgba(201, 162, 39, 0.72)) drop-shadow(0px 0px 8px rgba(232, 212, 139, 0.55))',
    drawer: '0 18px 50px rgba(47, 54, 40, 0.14)',
  },
  motion: {
    ease: [0.22, 1, 0.36, 1] as const,
    duration: 0.42,
    hoverDuration: 0.22,
  },
  leaf: {
    width: 168,
    height: 112,
    founderScale: 1.28,
    path:
      'M84 8 C108 20 126 44 124 68 C122 88 104 106 84 110 C64 106 46 88 44 68 C42 44 60 20 84 8 Z',
    innerPath:
      'M84 18 C102 28 114 46 112 66 C110 82 98 94 84 96 C70 94 58 82 56 66 C54 46 66 28 84 18 Z',
  },
  branch: {
    baseWidth: 2.2,
    rootWidth: 5.4,
    taperFactor: 0.72,
  },
} as const;

export interface GenerationPalette {
  fill: string;
  fillAccent: string;
  stroke: string;
  text: string;
  badge: string;
  vein: string;
}

export function getGenerationPalette(generation: number): GenerationPalette {
  switch (generation) {
    case 0:
      return {
        fill: '#f7f2e4',
        fillAccent: '#efe4c8',
        stroke: '#c9a227',
        text: '#4a3f1f',
        badge: '#e8d48b',
        vein: 'rgba(201, 162, 39, 0.25)',
      };
    case 1:
      return {
        fill: '#4a5a38',
        fillAccent: '#3d4a2c',
        stroke: '#2f3922',
        text: '#f5f3ea',
        badge: '#5c6b44',
        vein: 'rgba(255, 255, 255, 0.12)',
      };
    case 2:
      return {
        fill: '#7f9468',
        fillAccent: '#6f8558',
        stroke: '#5c6b44',
        text: '#1f2918',
        badge: '#b8c9a8',
        vein: 'rgba(31, 41, 24, 0.12)',
      };
    case 3:
      return {
        fill: '#b8c9a8',
        fillAccent: '#a8b996',
        stroke: '#8fa67a',
        text: '#24301c',
        badge: '#d5e0cb',
        vein: 'rgba(36, 48, 28, 0.1)',
      };
    default: {
      const fade = Math.min(generation - 4, 3);
      return {
        fill: `hsl(82, 22%, ${88 - fade * 3}%)`,
        fillAccent: `hsl(82, 18%, ${84 - fade * 3}%)`,
        stroke: '#b8c9a8',
        text: '#3d4a2c',
        badge: '#eef2e8',
        vein: 'rgba(61, 74, 44, 0.08)',
      };
    }
  }
}

export function applyBotanicalCssVariables(root: HTMLElement = document.documentElement) {
  const { colors, shadows } = botanicalTheme;
  root.style.setProperty('--botanical-canvas-bg', colors.canvasBg);
  root.style.setProperty('--botanical-canvas-bg-end', colors.canvasBgEnd);
  root.style.setProperty('--botanical-gold', colors.gold);
  root.style.setProperty('--botanical-glass', colors.glass);
  root.style.setProperty('--botanical-glass-border', colors.glassBorder);
  root.style.setProperty('--botanical-drawer-bg', colors.drawerBg);
  root.style.setProperty('--botanical-shadow-drawer', shadows.drawer);
}
