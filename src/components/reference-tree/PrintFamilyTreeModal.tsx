import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import treeBackground from '../../assets/family-tree/reference/tree-background.svg';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import {
  computePrintLayoutPlan,
  DEFAULT_PRINT_SETTINGS,
  printFamilyTree,
  type FamilyTreePrintSettings,
  type PrintMarginSize,
  type PrintOrientation,
  type PrintPaperSize,
  type PrintScaleMode,
} from '../../utils/familyTreePrint';
import type { FamilyTreeFlowHandle } from './FamilyTreeFlow';
import { IconClose, IconPrint } from './referenceTreeIcons';

interface PrintFamilyTreeModalProps {
  open: boolean;
  familyName?: string | null;
  members: FamilyMemberInput[];
  exportTargetRef: React.RefObject<HTMLElement | null>;
  flowHandleRef: React.RefObject<FamilyTreeFlowHandle | null>;
  onClose: () => void;
  onToast: (message: string) => void;
}

const PAPER_OPTIONS: PrintPaperSize[] = ['A4', 'A3', 'A2', 'A1', 'A0'];
const SCALE_OPTIONS: Array<{ id: PrintScaleMode; label: string }> = [
  { id: 'fit-page', label: 'ملاءمة الصفحة' },
  { id: 'fit-width', label: 'ملاءمة العرض' },
  { id: '100%', label: '100%' },
  { id: 'custom', label: 'تكبير مخصص' },
];

export function PrintFamilyTreeModal({
  open,
  familyName,
  members,
  exportTargetRef,
  flowHandleRef,
  onClose,
  onToast,
}: PrintFamilyTreeModalProps) {
  const [settings, setSettings] = useState<FamilyTreePrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrinting(false);
    }
  }, [open]);

  const layoutPlan = useMemo(() => {
    try {
      return computePrintLayoutPlan(members, settings);
    } catch {
      return null;
    }
  }, [members, settings]);

  const updateSettings = useCallback(<K extends keyof FamilyTreePrintSettings>(
    key: K,
    value: FamilyTreePrintSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const handlePrint = useCallback(async () => {
    const target = exportTargetRef.current;
    if (!target || !layoutPlan) {
      onToast('تعذّر تجهيز الطباعة');
      return;
    }

    setPrinting(true);
    try {
      const result = await printFamilyTree({
        members,
        familyName,
        settings,
        exportElement: target,
        backgroundUrl: treeBackground,
        prepareView: async () => {
          flowHandleRef.current?.fitView();
        },
      });
      onToast(`جاري الطباعة — ${result.pageCount} صفحة`);
    } catch {
      onToast('تعذّر إنشاء مستند الطباعة');
    } finally {
      setPrinting(false);
    }
  }, [exportTargetRef, familyName, flowHandleRef, layoutPlan, members, onToast, settings]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay print-tree-overlay open"
      aria-hidden={false}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="print-tree-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="printTreeTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>

        <div className="print-tree-modal__header">
          <div className="print-tree-modal__icon" aria-hidden>
            <IconPrint />
          </div>
          <div>
            <h2 id="printTreeTitle" className="print-tree-modal__title">طباعة شجرة العائلة</h2>
            <p className="print-tree-modal__subtitle">
              إعدادات احترافية للحفاظ على وضوح الأسماء والخطوط حتى في الأشجار الكبيرة
            </p>
          </div>
        </div>

        <div className="print-tree-settings">
          <label className="print-setting">
            <span>حجم الورق</span>
            <select
              value={settings.paperSize}
              onChange={(event) => updateSettings('paperSize', event.target.value as PrintPaperSize)}
            >
              {PAPER_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <label className="print-setting">
            <span>الاتجاه</span>
            <select
              value={settings.orientation}
              onChange={(event) => updateSettings('orientation', event.target.value as PrintOrientation)}
            >
              <option value="landscape">أفقي (افتراضي)</option>
              <option value="portrait">عمودي</option>
            </select>
          </label>

          <label className="print-setting">
            <span>المقياس</span>
            <select
              value={settings.scaleMode}
              onChange={(event) => updateSettings('scaleMode', event.target.value as PrintScaleMode)}
            >
              {SCALE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          {settings.scaleMode === 'custom' ? (
            <label className="print-setting">
              <span>التكبير (%)</span>
              <input
                type="number"
                min={25}
                max={300}
                step={5}
                value={settings.customZoom}
                onChange={(event) => updateSettings('customZoom', Number(event.target.value) || 100)}
              />
            </label>
          ) : null}

          <label className="print-setting">
            <span>الهوامش</span>
            <select
              value={settings.margins}
              onChange={(event) => updateSettings('margins', event.target.value as PrintMarginSize)}
            >
              <option value="none">بدون</option>
              <option value="small">صغيرة</option>
              <option value="normal">عادية</option>
            </select>
          </label>

          <label className="print-setting">
            <span>الألوان</span>
            <select
              value={settings.colorMode}
              onChange={(event) => updateSettings(
                'colorMode',
                event.target.value as FamilyTreePrintSettings['colorMode'],
              )}
            >
              <option value="color">ملون</option>
              <option value="grayscale">تدرج رمادي</option>
            </select>
          </label>

          <label className="print-setting print-setting--checkbox">
            <input
              type="checkbox"
              checked={settings.includeBackground}
              onChange={(event) => updateSettings('includeBackground', event.target.checked)}
            />
            <span>إظهار الخلفية</span>
          </label>
        </div>

        <section className="print-tree-preview" aria-live="polite">
          <div className="print-tree-preview__meta">
            <strong>
              {layoutPlan ? `${layoutPlan.totalPages} صفحة` : '0 صفحة'}
            </strong>
            {layoutPlan ? (
              <span>
                {layoutPlan.pagesX}
                {' × '}
                {layoutPlan.pagesY}
                {' — '}
                {layoutPlan.useVector ? 'طباعة متجهة (SVG)' : 'طباعة عالية الدقة'}
              </span>
            ) : null}
          </div>

          {layoutPlan ? (
            <div
              className="print-tree-preview__grid"
              style={{
                gridTemplateColumns: `repeat(${layoutPlan.pagesX}, minmax(0, 1fr))`,
              }}
            >
              {layoutPlan.tiles.map((tile) => (
                <div key={tile.index} className="print-tree-preview__page" title={`صفحة ${tile.index + 1}`}>
                  <span>{tile.index + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="print-tree-preview__empty">لا توجد بيانات كافية للمعاينة</p>
          )}
        </section>

        <div className="print-tree-actions">
          <button type="button" className="print-tree-btn print-tree-btn--ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="print-tree-btn print-tree-btn--primary"
            disabled={printing || !layoutPlan}
            onClick={() => void handlePrint()}
          >
            <IconPrint />
            <span>{printing ? 'جاري التجهيز...' : 'طباعة'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
