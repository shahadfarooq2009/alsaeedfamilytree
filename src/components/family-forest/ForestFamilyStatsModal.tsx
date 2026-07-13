import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { computeForestFamilyStats } from '../../utils/familyForest/computeForestFamilyStats';
import {
  exportForestFamilyStatsExcel,
  printForestFamilyStats,
} from '../../utils/familyForest/exportForestFamilyStats';
import { IconClose, IconPrint, IconUsers } from '../reference-tree/referenceTreeIcons';

interface ForestFamilyStatsModalProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  familyName?: string | null;
  members: FamilyMemberInput[];
  people?: PersonSummary[];
  onClose: () => void;
  onToast?: (message: string) => void;
}

interface AnchorPosition {
  bottom: number;
  centerX: number;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="forest-family-stats__summary-card">
      <span className="forest-family-stats__summary-label">{label}</span>
      <strong className="forest-family-stats__summary-value">{value}</strong>
    </div>
  );
}

function StatsTable({
  title,
  rows,
  nameLabel = 'الاسم',
  valueLabel = 'العدد',
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
  nameLabel?: string;
  valueLabel?: string;
}) {
  return (
    <section className="forest-family-stats__section">
      <h3 className="forest-family-stats__section-title">{title}</h3>
      <div className="forest-family-stats__table-wrap">
        <table className="forest-family-stats__table">
          <thead>
            <tr>
              <th scope="col">{nameLabel}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${title}-${row.name}`}>
                  <td>{row.name}</td>
                  <td>
                    <strong>{row.count}</strong>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="forest-family-stats__empty">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ForestFamilyStatsModal({
  open,
  anchorRef,
  familyName,
  members,
  people = [],
  onClose,
  onToast,
}: ForestFamilyStatsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<AnchorPosition | null>(null);

  const displayName = familyName?.trim() || 'عائلة السعيد';
  const stats = useMemo(
    () => computeForestFamilyStats(members, people),
    [members, people],
  );

  const updateAnchor = useCallback(() => {
    const button = anchorRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setAnchor({
      bottom: Math.max(12, window.innerHeight - rect.top + 12),
      centerX: rect.left + rect.width / 2,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return undefined;
    }
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [anchorRef, onClose, open]);

  const handleExport = useCallback(() => {
    exportForestFamilyStatsExcel(stats, displayName, members);
    onToast?.('تم تصدير الإحصائيات');
  }, [displayName, members, onToast, stats]);

  const handlePrint = useCallback(() => {
    printForestFamilyStats(stats, displayName, members);
  }, [displayName, members, stats]);

  const handleViewAll = useCallback(() => {
    exportForestFamilyStatsExcel(stats, displayName, members);
    onToast?.('تم تصدير قائمة كل الأفراد');
  }, [displayName, members, onToast, stats]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`forest-family-stats-backdrop${visible ? ' is-visible' : ''}`}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`forest-family-stats${visible ? ' is-visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="إحصائيات أفراد العائلة"
        style={
          anchor
            ? ({
                '--forest-stats-bottom': `${anchor.bottom}px`,
                '--forest-stats-center-x': `${anchor.centerX}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <header className="forest-family-stats__header">
          <div className="forest-family-stats__title-wrap">
            <span className="forest-family-stats__badge" aria-hidden>
              <IconUsers />
            </span>
            <div>
              <h2 className="forest-family-stats__title">إحصائيات العائلة</h2>
              <p className="forest-family-stats__subtitle">{displayName}</p>
            </div>
          </div>
          <button
            type="button"
            className="forest-family-stats__close"
            aria-label="إغلاق"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </header>

        <div className="forest-family-stats__body">
          <section className="forest-family-stats__summary">
            <SummaryCard label="إجمالي الأفراد" value={stats.total} />
            <SummaryCard label="الذكور" value={stats.males} />
            <SummaryCard label="الإناث" value={stats.females} />
            <SummaryCard label="الأحياء" value={stats.living} />
            <SummaryCard label="المتوفون" value={stats.deceased} />
            <SummaryCard label="بيانات غير مكتملة" value={stats.incomplete} />
          </section>

          <StatsTable
            title="حسب الأجيال"
            nameLabel="الجيل"
            rows={stats.generations.map((generation) => ({
              name: generation.label,
              count: generation.count,
            }))}
          />

        </div>

        <footer className="forest-family-stats__actions">
          <button type="button" className="forest-family-stats__action" onClick={handleViewAll}>
            عرض كل الأفراد
          </button>
          <button type="button" className="forest-family-stats__action" onClick={handleExport}>
            تصدير Excel
          </button>
          <button
            type="button"
            className="forest-family-stats__action forest-family-stats__action--ghost"
            onClick={handlePrint}
          >
            <IconPrint />
            <span>طباعة</span>
          </button>
          <button
            type="button"
            className="forest-family-stats__action forest-family-stats__action--primary"
            onClick={onClose}
          >
            إغلاق
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
