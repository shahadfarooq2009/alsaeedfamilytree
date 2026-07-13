export interface SavedTreeMapView {
  panX: number;
  panY: number;
  scale: number;
  locked: boolean;
}

const STORAGE_PREFIX = 'family-tree-map-view:';

function storageKey(familyId: number): string {
  return `${STORAGE_PREFIX}${familyId}`;
}

export function loadSavedTreeMapView(familyId: number): SavedTreeMapView | null {
  if (familyId <= 0) return null;

  try {
    const raw = localStorage.getItem(storageKey(familyId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedTreeMapView>;
    if (
      typeof parsed.panX !== 'number'
      || typeof parsed.panY !== 'number'
      || typeof parsed.scale !== 'number'
      || parsed.locked !== true
    ) {
      return null;
    }

    return {
      panX: parsed.panX,
      panY: parsed.panY,
      scale: parsed.scale,
      locked: true,
    };
  } catch {
    return null;
  }
}

export function saveTreeMapView(familyId: number, view: SavedTreeMapView): void {
  if (familyId <= 0) return;

  try {
    localStorage.setItem(storageKey(familyId), JSON.stringify(view));
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}

export function clearSavedTreeMapView(familyId: number): void {
  if (familyId <= 0) return;

  try {
    localStorage.removeItem(storageKey(familyId));
  } catch {
    // Ignore storage errors.
  }
}
