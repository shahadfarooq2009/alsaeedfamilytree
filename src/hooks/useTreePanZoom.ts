import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeFitPanZoom,
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  isPanZoomViewFullyVisible,
} from '../utils/treeLayout/fitToViewport';
import {
  clearSavedTreeMapView,
  loadSavedTreeMapView,
  saveTreeMapView,
} from '../utils/treeMapViewStorage';

interface PanZoomState {
  scale: number;
  panX: number;
  panY: number;
}

interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface UseTreePanZoomOptions {
  canvasWidth: number;
  canvasHeight: number;
  contentBounds: ContentBounds;
  viewportRef: React.RefObject<HTMLElement | null>;
  familyId?: number;
  minScale?: number;
  maxScale?: number;
  fitAllMembers?: boolean;
  layoutFillsStage?: boolean;
  disablePanZoom?: boolean;
  layoutSignature?: string;
}

const SCALE_STEP = 0.1;
const ARROW_PAN_STEP = 28;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function boundsKey(bounds: ContentBounds): string {
  return [
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
  ].map((value) => Math.round(value)).join(':');
}

function readSavedView(familyId?: number) {
  if (familyId == null || familyId <= 0) return null;
  return loadSavedTreeMapView(familyId);
}

function savedViewIsValid(
  savedView: NonNullable<ReturnType<typeof readSavedView>>,
  contentBounds: ContentBounds,
  viewportRef: React.RefObject<HTMLElement | null>,
): boolean {
  const viewport = viewportRef.current;
  if (!viewport) return false;

  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return isPanZoomViewFullyVisible(
    savedView,
    contentBounds,
    rect.width,
    rect.height,
  );
}

export function useTreePanZoom({
  canvasWidth,
  canvasHeight,
  contentBounds,
  viewportRef,
  familyId,
  minScale = FIT_MIN_ZOOM,
  maxScale = FIT_MAX_ZOOM,
  fitAllMembers = true,
  layoutFillsStage = false,
  disablePanZoom = false,
  layoutSignature = '',
}: UseTreePanZoomOptions) {
  const initialSavedView = readSavedView(familyId);
  const interactionLocked = disablePanZoom;
  const positionLockedRef = useRef(initialSavedView?.locked ?? false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [isPositionLocked, setIsPositionLocked] = useState(initialSavedView?.locked ?? false);
  const [state, setState] = useState<PanZoomState>(() => (
    initialSavedView?.locked
      ? {
        scale: initialSavedView.scale,
        panX: initialSavedView.panX,
        panY: initialSavedView.panY,
      }
      : { scale: 1, panX: 0, panY: 0 }
  ));
  const [isDragging, setIsDragging] = useState(false);
  const lastFitKeyRef = useRef('');

  const fitToView = useCallback(() => {
    if (positionLockedRef.current) {
      return true;
    }

    const viewport = viewportRef.current;
    if (!viewport || canvasWidth <= 0 || canvasHeight <= 0) {
      return false;
    }

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const rawW = contentBounds.maxX - contentBounds.minX;
    const rawH = contentBounds.maxY - contentBounds.minY;
    if (rawW <= 0 || rawH <= 0) {
      return false;
    }

    const next = computeFitPanZoom(contentBounds, rect.width, rect.height);
    setState(next);
    return true;
  }, [
    canvasWidth,
    canvasHeight,
    contentBounds,
    viewportRef,
    maxScale,
    minScale,
    fitAllMembers,
    layoutFillsStage,
  ]);

  useEffect(() => {
    const fitKey = `${layoutSignature}|${boundsKey(contentBounds)}`;
    if (lastFitKeyRef.current === fitKey) return;

    if (positionLockedRef.current && familyId != null && familyId > 0) {
      const savedView = loadSavedTreeMapView(familyId);
      if (
        savedView?.locked
        && !savedViewIsValid(savedView, contentBounds, viewportRef)
      ) {
        clearSavedTreeMapView(familyId);
        positionLockedRef.current = false;
        setIsPositionLocked(false);
      }
    }

    const applied = fitToView();
    if (applied) {
      lastFitKeyRef.current = fitKey;
    }
  }, [fitToView, layoutSignature, contentBounds, familyId, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const observer = new ResizeObserver(() => {
      if (positionLockedRef.current) return;
      lastFitKeyRef.current = '';
      fitToView();
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [fitToView, viewportRef]);

  const persistLockedView = useCallback((view: PanZoomState) => {
    if (!positionLockedRef.current || familyId == null || familyId <= 0) return;
    saveTreeMapView(familyId, {
      panX: view.panX,
      panY: view.panY,
      scale: view.scale,
      locked: true,
    });
  }, [familyId]);

  const zoomIn = useCallback(() => {
    if (interactionLocked) return;
    setState((current) => {
      const next = {
        ...current,
        scale: Math.min(maxScale, Number((current.scale + SCALE_STEP).toFixed(3))),
      };
      persistLockedView(next);
      return next;
    });
  }, [interactionLocked, maxScale, persistLockedView]);

  const zoomOut = useCallback(() => {
    if (interactionLocked) return;
    setState((current) => {
      const next = {
        ...current,
        scale: Math.max(minScale, Number((current.scale - SCALE_STEP).toFixed(3))),
      };
      persistLockedView(next);
      return next;
    });
  }, [interactionLocked, minScale, persistLockedView]);

  const recenter = useCallback(() => {
    if (familyId != null && familyId > 0) {
      clearSavedTreeMapView(familyId);
    }
    positionLockedRef.current = false;
    setIsPositionLocked(false);
    setIsMoveMode(false);
    lastFitKeyRef.current = '';
    fitToView();
  }, [familyId, fitToView]);

  const toggleMoveMode = useCallback(() => {
    if (positionLockedRef.current || interactionLocked) return;
    setIsMoveMode((current) => !current);
  }, [interactionLocked]);

  const lockPosition = useCallback(() => {
    setState((current) => {
      if (familyId != null && familyId > 0) {
        saveTreeMapView(familyId, {
          panX: current.panX,
          panY: current.panY,
          scale: current.scale,
          locked: true,
        });
      }
      return current;
    });
    positionLockedRef.current = true;
    setIsPositionLocked(true);
    setIsMoveMode(false);
    lastFitKeyRef.current = `${layoutSignature}|${boundsKey(contentBounds)}`;
  }, [contentBounds, familyId, layoutSignature]);

  const zoomInAtPoint = useCallback(
    (contentX: number, contentY: number, zoomFactor = 1.38) => {
      if (interactionLocked) return;
      setState((current) => {
        const scale = Math.min(
          maxScale,
          Number((current.scale * zoomFactor).toFixed(3)),
        );
        if (scale === current.scale) return current;

        const screenX = current.panX + contentX * current.scale;
        const screenY = current.panY + contentY * current.scale;

        return {
          scale,
          panX: screenX - contentX * scale,
          panY: screenY - contentY * scale,
        };
      });
    },
    [interactionLocked, maxScale],
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (interactionLocked || event.button !== 0) return;
    setIsDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [interactionLocked]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (interactionLocked || !isDragging) return;
      setState((current) => ({
        ...current,
        panX: current.panX + event.movementX,
        panY: current.panY + event.movementY,
      }));
    },
    [interactionLocked, isDragging],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      if (interactionLocked) return;
      setState((current) => {
        const delta = -Math.sign(event.deltaY) * SCALE_STEP;
        const next = {
          ...current,
          scale: Math.min(maxScale, Math.max(minScale, Number((current.scale + delta).toFixed(3)))),
        };
        persistLockedView(next);
        return next;
      });
    },
    [interactionLocked, minScale, maxScale, persistLockedView],
  );

  useEffect(() => {
    if (!isMoveMode || isPositionLocked || interactionLocked) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      let dx = 0;
      let dy = 0;

      switch (event.key) {
        case 'ArrowUp':
          dy = ARROW_PAN_STEP;
          break;
        case 'ArrowDown':
          dy = -ARROW_PAN_STEP;
          break;
        case 'ArrowLeft':
          dx = ARROW_PAN_STEP;
          break;
        case 'ArrowRight':
          dx = -ARROW_PAN_STEP;
          break;
        default:
          return;
      }

      event.preventDefault();
      setState((current) => {
        const next = {
          ...current,
          panX: current.panX + dx,
          panY: current.panY + dy,
        };
        persistLockedView(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [interactionLocked, isMoveMode, isPositionLocked, persistLockedView]);

  return {
    scale: state.scale,
    panX: state.panX,
    panY: state.panY,
    isDragging,
    isMoveMode,
    isPositionLocked,
    zoomIn,
    zoomOut,
    recenter,
    toggleMoveMode,
    lockPosition,
    zoomInAtPoint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    fitToView,
  };
}
