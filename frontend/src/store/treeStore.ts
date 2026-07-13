import { create } from 'zustand';

interface TreeStoreState {
  selectedPersonId: number | null;
  highlightedPersonId: number | null;
  setSelectedPersonId: (personId: number | null) => void;
  setHighlightedPersonId: (personId: number | null) => void;
}

export const useTreeStore = create<TreeStoreState>((set) => ({
  selectedPersonId: null,
  highlightedPersonId: null,
  setSelectedPersonId: (personId) => set({ selectedPersonId: personId }),
  setHighlightedPersonId: (personId) => set({ highlightedPersonId: personId }),
}));
