import {
  IconFullscreen,
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
  | 'share';

interface ReferenceTreeToolbarProps {
  onAction: (action: ToolbarAction) => void;
}

export function ReferenceTreeToolbar({ onAction }: ReferenceTreeToolbarProps) {
  return (
    <div className="toolbar" id="toolbar">
      <button type="button" className="pill" data-action="fullscreen" onClick={() => onAction('fullscreen')}>
        <IconFullscreen />
        <span>عرض كامل</span>
      </button>
      <div className="pill pill-group">
        <button type="button" className="pill-btn" data-action="zoom-in" onClick={() => onAction('zoom-in')}>
          <IconZoomIn />
          <span>تكبير</span>
        </button>
        <span className="divider" />
        <button type="button" className="pill-btn" data-action="zoom-out" onClick={() => onAction('zoom-out')}>
          <IconZoomOut />
          <span>تصغير</span>
        </button>
        <span className="divider" />
        <button type="button" className="pill-btn" data-action="fit-all" onClick={() => onAction('fit-all')}>
          <IconRecenter />
          <span>عرض الكل</span>
        </button>
        <span className="divider" />
        <button type="button" className="pill-btn" data-action="recenter" onClick={() => onAction('recenter')}>
          <IconRecenter />
          <span>إعادة توسيط</span>
        </button>
      </div>
      <button type="button" className="pill pill-share" data-action="share" onClick={() => onAction('share')}>
        <IconShare />
        <span>مشاركة الشجرة</span>
      </button>
    </div>
  );
}
