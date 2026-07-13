import type { SyntheticEvent } from 'react';
import {
  IconPrint,
  IconRecenter,
  IconShare,
  IconZoomIn,
  IconZoomOut,
} from './referenceTreeIcons';

export type ToolbarAction =
  | 'fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'recenter'
  | 'fit-all'
  | 'toggle-move'
  | 'lock-position'
  | 'share'
  | 'print';

interface ReferenceTreeToolbarProps {
  onAction: (action: ToolbarAction) => void;
  onPrint?: () => void;
  controlsReady?: boolean;
  zoomOutDisabled?: boolean;
  resetDisabled?: boolean;
  dimmed?: boolean;
}

export function ReferenceTreeToolbar({
  onAction,
  onPrint,
  controlsReady = false,
  zoomOutDisabled = true,
  resetDisabled = true,
  dimmed = false,
}: ReferenceTreeToolbarProps) {
  const stopMapPan = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className={`toolbar reference-toolbar${dimmed ? ' is-behind-modal' : ''}`}
      id="toolbar"
      onPointerDown={stopMapPan}
      onMouseDown={stopMapPan}
      onTouchStart={stopMapPan}
    >
      <div className="reference-toolbar-start">
        <button type="button" className="pill pill-share" data-action="share" onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAction('share');
        }}>
          <IconShare />
          <span>مشاركة الشجرة</span>
        </button>
        <button
          type="button"
          className="pill pill-print"
          data-action="print"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (onPrint) {
              onPrint();
            } else {
              onAction('print');
            }
          }}
        >
          <IconPrint />
          <span>طباعة</span>
        </button>
      </div>

      <div className="pill pill-group reference-toolbar-zoom">
        <button
          type="button"
          className="pill-btn"
          data-action="zoom-in"
          disabled={!controlsReady}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAction('zoom-in');
          }}
        >
          <IconZoomIn />
          <span>تكبير</span>
        </button>
        <span className="divider" />
        <button
          type="button"
          className="pill-btn"
          data-action="zoom-out"
          disabled={!controlsReady || zoomOutDisabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAction('zoom-out');
          }}
        >
          <IconZoomOut />
          <span>تصغير</span>
        </button>
        <span className="divider" />
        <button
          type="button"
          className="pill-btn"
          data-action="recenter"
          disabled={!controlsReady || resetDisabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAction('recenter');
          }}
        >
          <IconRecenter />
          <span>إعادة ضبط</span>
        </button>
      </div>
    </div>
  );
}
