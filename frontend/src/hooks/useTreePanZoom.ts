import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  FIT_VIEWPORT_PADDING,
} from '../utils/treeLayout/fitToViewport';

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
  minScale?: number;
  maxScale?: number;
  fitAllMembers?: boolean;
  layoutFillsStage?: boolean;
  disablePanZoom?: boolean;
  layoutSignature?: string;
}

const SCALE_STEP = 0.1;

export function useTreePanZoom({
  canvasWidth,
  canvasHeight,
  contentBounds,
  viewportRef,
  minScale = FIT_MIN_ZOOM,
  maxScale = FIT_MAX_ZOOM,
  fitAllMembers = true,
  layoutFillsStage = false,
  disablePanZoom = false,
  layoutSignature = '',
}: UseTreePanZoomOptions) {
  const interactionLocked = disablePanZoom;
  const [state, setState] = useState<PanZoomState>({
    scale: 1,
    panX: 0,
    panY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const lastFitSignatureRef = useRef('');

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || canvasWidth <= 0 || canvasHeight <= 0) return;

    if (layoutFillsStage) {
      setState({ scale: 1, panX: 0, panY: 0 });
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pad = FIT_VIEWPORT_PADDING;

    const rawW = contentBounds.maxX - contentBounds.minX;
    const rawH = contentBounds.maxY - contentBounds.minY;
    const boundsSane = Number.isFinite(rawW) && Number.isFinite(rawH)
      && rawW > 0 && rawH > 0
      && rawW <= canvasWidth * 2.5
      && rawH <= canvasHeight * 2.5;

    const fitBounds = boundsSane
      ? contentBounds
      : { minX: 0, minY: 0, maxX: canvasWidth, maxY: canvasHeight };

    const contentW = Math.max(1, fitBounds.maxX - fitBounds.minX);
    const contentH = Math.max(1, fitBounds.maxY - fitBounds.minY);

    const scaleX = (rect.width - pad * 2) / contentW;
    const scaleY = (rect.height - pad * 2) / contentH;
    let fitScale = fitAllMembers
      ? Math.min(scaleX, scaleY)
      : Math.min(scaleX, scaleY, 1);

    fitScale = Math.max(minScale, Math.min(maxScale, fitScale));

    const scaledW = contentW * fitScale;
    const scaledH = contentH * fitScale;

    setState({
      scale: fitScale,
      panX: (rect.width - scaledW) / 2 - fitBounds.minX * fitScale,
      panY: (rect.height - scaledH) / 2 - fitBounds.minY * fitScale,
    });
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
    if (lastFitSignatureRef.current === layoutSignature && lastFitSignatureRef.current !== '') {
      return;
    }
    lastFitSignatureRef.current = layoutSignature;
    fitToView();
  }, [fitToView, layoutSignature]);

  useEffect(() => {
    const onResize = () => fitToView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToView]);

  const zoomIn = useCallback(() => {
    if (interactionLocked) return;
    setState((current) => ({
      ...current,
      scale: Math.min(maxScale, Number((current.scale + SCALE_STEP).toFixed(3))),
    }));
  }, [interactionLocked, maxScale]);

  const zoomOut = useCallback(() => {
    if (interactionLocked) return;
    setState((current) => ({
      ...current,
      scale: Math.max(minScale, Number((current.scale - SCALE_STEP).toFixed(3))),
    }));
  }, [interactionLocked, minScale]);

  const recenter = useCallback(() => {
    fitToView();
  }, [fitToView]);

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
      if (!(event.ctrlKey || event.metaKey)) return;
      setState((current) => {
        const delta = -Math.sign(event.deltaY) * SCALE_STEP;
        return {
          ...current,
          scale: Math.min(maxScale, Math.max(minScale, Number((current.scale + delta).toFixed(3)))),
        };
      });
    },
    [interactionLocked, minScale, maxScale],
  );

  return {
    scale: state.scale,
    panX: state.panX,
    panY: state.panY,
    isDragging,
    zoomIn,
    zoomOut,
    recenter,
    zoomInAtPoint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    fitToView,
  };
}
