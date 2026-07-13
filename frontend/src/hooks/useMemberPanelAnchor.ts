import { useCallback, useLayoutEffect, useState } from 'react';
import {
  computeMemberPanelAnchor,
  type MemberPanelAnchor,
} from '../utils/computeMemberPanelAnchor';

interface UseMemberPanelAnchorOptions {
  viewportRef: React.RefObject<HTMLElement | null>;
  membersRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLElement | null>;
  selectedId: number | null;
  panelOpen: boolean;
  panelVisible: boolean;
  panX: number;
  panY: number;
  scale: number;
}

export function useMemberPanelAnchor({
  viewportRef,
  membersRef,
  panelRef,
  selectedId,
  panelOpen,
  panelVisible,
  panX,
  panY,
  scale,
}: UseMemberPanelAnchorOptions): MemberPanelAnchor | null {
  const [anchor, setAnchor] = useState<MemberPanelAnchor | null>(null);

  const updateAnchor = useCallback(() => {
    if (!panelOpen || selectedId == null || !viewportRef.current || !membersRef.current) {
      setAnchor(null);
      return;
    }

    const card = membersRef.current.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    if (!card) {
      setAnchor(null);
      return;
    }

    setAnchor(computeMemberPanelAnchor(
      viewportRef.current,
      card,
      panelRef.current,
    ));
  }, [membersRef, panelOpen, panelRef, selectedId, viewportRef]);

  useLayoutEffect(() => {
    updateAnchor();
  }, [updateAnchor, panelVisible, panX, panY, scale]);

  useLayoutEffect(() => {
    if (!panelOpen) return undefined;

    window.addEventListener('resize', updateAnchor);
    return () => window.removeEventListener('resize', updateAnchor);
  }, [panelOpen, updateAnchor]);

  return anchor;
}
