import { useEffect, useId, useRef, useState } from 'react';
import {
  TREE_BACKGROUND_PRESETS,
  type TreeBackgroundMode,
  type TreeBackgroundSettings,
} from '../../utils/treeBackgroundStorage';

interface TreeBackgroundPickerProps {
  settings: TreeBackgroundSettings;
  onChange: (settings: TreeBackgroundSettings) => void;
}

export function TreeBackgroundPicker({ settings, onChange }: TreeBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const setMode = (mode: TreeBackgroundMode) => {
    onChange({ ...settings, mode });
  };

  const setSolidColor = (solidColor: string) => {
    onChange({ mode: 'solid', solidColor });
  };

  return (
    <div className="tree-bg-picker" ref={rootRef}>
      <button
        type="button"
        className={`tree-bg-picker-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        title="تغيير خلفية الشجرة"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tree-bg-picker-swatch" aria-hidden="true">
          {settings.mode === 'image' ? (
            <span className="tree-bg-picker-swatch-image" />
          ) : (
            <span
              className="tree-bg-picker-swatch-color"
              style={{ backgroundColor: settings.solidColor }}
            />
          )}
        </span>
        <span className="tree-bg-picker-label">الخلفية</span>
      </button>

      {open ? (
        <div className="tree-bg-picker-panel" id={panelId} role="dialog" aria-label="إعدادات الخلفية">
          <p className="tree-bg-picker-title">خلفية الشجرة</p>

          <div className="tree-bg-picker-modes" role="group" aria-label="نوع الخلفية">
            <button
              type="button"
              className={`tree-bg-picker-mode${settings.mode === 'image' ? ' is-active' : ''}`}
              aria-pressed={settings.mode === 'image'}
              onClick={() => setMode('image')}
            >
              صورة
            </button>
            <button
              type="button"
              className={`tree-bg-picker-mode${settings.mode === 'solid' ? ' is-active' : ''}`}
              aria-pressed={settings.mode === 'solid'}
              onClick={() => setMode('solid')}
            >
              لون ثابت
            </button>
          </div>

          {settings.mode === 'solid' ? (
            <div className="tree-bg-picker-colors">
              <div className="tree-bg-picker-swatches" role="list">
                {TREE_BACKGROUND_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`tree-bg-picker-color${settings.solidColor === color ? ' is-active' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-label={`لون ${color}`}
                    aria-pressed={settings.solidColor === color}
                    onClick={() => setSolidColor(color)}
                  />
                ))}
              </div>

              <label className="tree-bg-picker-custom">
                <span>لون مخصص</span>
                <input
                  type="color"
                  value={settings.solidColor}
                  onChange={(event) => setSolidColor(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className="tree-bg-picker-hint">صورة الشجرة الافتراضية</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
