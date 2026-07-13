import { createContext, useContext } from 'react';

export interface ForestCardHoverHandlers {
  onCardEnter: (memberId: number) => void;
  onCardLeave: () => void;
  editable?: boolean;
  familyId?: number;
  onMemberUpdated?: () => Promise<void> | void;
  onToast?: (message: string) => void;
  onOpenMemberPanel?: (memberId: number) => void;
}

export const ForestCardHoverContext = createContext<ForestCardHoverHandlers | null>(null);

export function useForestCardHover(): ForestCardHoverHandlers | null {
  return useContext(ForestCardHoverContext);
}
