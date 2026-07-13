import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FamilyTreeMapPerson } from './FamilyTreeMap';
import { BotanicalTree } from './FamilyTreeMap';
import { buildBotanicalTreeLayout } from '../../utils/buildBotanicalTreeLayout';
import './FamilyTreeMap.css';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

export interface BotanicalTreeViewProps {
  people: FamilyTreeMapPerson[];
  onSelectMember?: (id: number) => void;
  /** Changes to this value replay the branch-growth animation. */
  growthKey?: number | string;
}

/**
 * Self-contained, pannable/zoomable botanical tree. Handles its own viewport
 * fit-to-screen, wheel zoom, and drag-to-pan so it can be dropped anywhere as
 * an overlay.
 */
export function BotanicalTreeView({
  people,
  onSelectMember,
  growthKey = 0,
}: BotanicalTreeViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);

  const layout = useMemo(() => buildBotanicalTreeLayout(people), [people]);

  const fitToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw === 0 || vh === 0) return;

    const scale = Math.min(vw / layout.width, vh / layout.height, 1.15);
    setTransform({
      x: (vw - layout.width * scale) / 2,
      y: (vh - layout.height * scale) / 2,
      scale,
    });
  }, [layout.height, layout.width]);

  useEffect(() => {
    fitToScreen();
    const onResize = () => fitToScreen();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToScreen, growthKey]);

  function zoom(delta: number) {
    setTransform((current) => ({
      ...current,
      scale: Math.min(Math.max(current.scale + delta, 0.15), 2.5),
    }));
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.08 : 0.08);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    setDrag({
      startX: event.clientX,
      startY: event.clientY,
      baseX: transform.x,
      baseY: transform.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setTransform((current) => ({
      ...current,
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY,
    }));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  }

  return (
    <div className="botanical-view-root" dir="rtl">
      <div
        ref={viewportRef}
        className={`family-map-viewport is-move-mode${drag ? ' is-dragging' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        aria-label="شجرة العائلة الطبيعية"
      >
        <div
          className="family-map-canvas is-tree-view"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <BotanicalTree key={growthKey} layout={layout} onSelectMember={onSelectMember} />
        </div>
      </div>

      <div className="family-map-toolbar botanical-view-toolbar">
        <button type="button" onClick={() => zoom(0.12)}>
          تكبير +
        </button>
        <button type="button" onClick={() => zoom(-0.12)}>
          تصغير −
        </button>
        <button type="button" onClick={fitToScreen}>
          إعادة ضبط
        </button>
      </div>
    </div>
  );
}
