import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
  viewportRevision?: number;
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
  viewportRevision = 0,
}: UseMemberPanelAnchorOptions): MemberPanelAnchor | null {
  const [anchor, setAnchor] = useState<MemberPanelAnchor | null>(null);
  const lastAnchorRef = useRef<MemberPanelAnchor | null>(null);

  const updateAnchor = useCallback(() => {
    if (!panelOpen || selectedId == null || !viewportRef.current || !membersRef.current) {
      lastAnchorRef.current = null;
      setAnchor(null);
      return;
    }

    const card = membersRef.current.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    if (!card) {
      if (lastAnchorRef.current) {
        setAnchor(lastAnchorRef.current);
      }
      return;
    }

    const nextAnchor = computeMemberPanelAnchor(
      viewportRef.current,
      card,
      panelRef.current,
    );
    lastAnchorRef.current = nextAnchor;
    setAnchor(nextAnchor);
  }, [membersRef, panelOpen, panelRef, selectedId, viewportRef]);

  useLayoutEffect(() => {
    updateAnchor();
  }, [updateAnchor, panelVisible, panX, panY, scale, viewportRevision]);

  useLayoutEffect(() => {
    if (!panelOpen) return undefined;

    window.addEventListener('resize', updateAnchor);
    return () => window.removeEventListener('resize', updateAnchor);
  }, [panelOpen, updateAnchor]);

  return anchor;
}
