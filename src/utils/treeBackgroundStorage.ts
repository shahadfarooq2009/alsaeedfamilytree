export type TreeBackgroundMode = 'image' | 'solid';

export interface TreeBackgroundSettings {
  mode: TreeBackgroundMode;
  solidColor: string;
}

export const DEFAULT_TREE_BACKGROUND: TreeBackgroundSettings = {
  mode: 'image',
  solidColor: '#f6f3ea',
};

export const TREE_BACKGROUND_PRESETS = [
  '#f6f3ea',
  '#faf8f1',
  '#efe9db',
  '#ffffff',
  '#e8f0e4',
  '#dce6d4',
  '#2f3d2a',
  '#4a5540',
] as const;

const STORAGE_PREFIX = 'family-tree-bg:';

function storageKey(familyId: number): string {
  return `${STORAGE_PREFIX}${familyId}`;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function loadTreeBackgroundSettings(familyId: number): TreeBackgroundSettings {
  if (familyId <= 0) return { ...DEFAULT_TREE_BACKGROUND };

  try {
    const raw = localStorage.getItem(storageKey(familyId));
    if (!raw) return { ...DEFAULT_TREE_BACKGROUND };

    const parsed = JSON.parse(raw) as Partial<TreeBackgroundSettings>;
    const mode = parsed.mode === 'solid' ? 'solid' : 'image';
    const solidColor =
      typeof parsed.solidColor === 'string' && isValidHexColor(parsed.solidColor)
        ? parsed.solidColor
        : DEFAULT_TREE_BACKGROUND.solidColor;

    return { mode, solidColor };
  } catch {
    return { ...DEFAULT_TREE_BACKGROUND };
  }
}

export function saveTreeBackgroundSettings(
  familyId: number,
  settings: TreeBackgroundSettings,
): void {
  if (familyId <= 0) return;

  try {
    localStorage.setItem(storageKey(familyId), JSON.stringify(settings));
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}
