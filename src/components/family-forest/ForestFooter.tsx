import { useCallback, useRef, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import {
  IconPrint,
  IconRecenter,
  IconShare,
  IconUsers,
  IconZoomIn,
  IconZoomOut,
} from '../reference-tree/referenceTreeIcons';
import { ForestFamilyStatsModal } from './ForestFamilyStatsModal';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const DEFAULT_ZOOM = 0.92;

interface ForestFooterProps {
  memberCount: number;
  familyName?: string | null;
  members: FamilyMemberInput[];
  people?: PersonSummary[];
  mapCenterX?: number;
  onShare?: () => void;
  onPrint?: () => void;
  onToast?: (message: string) => void;
}

export function ForestFooter({
  memberCount,
  familyName,
  members,
  people = [],
  mapCenterX = 0,
  onShare,
  onPrint,
  onToast,
}: ForestFooterProps) {
  const { zoomIn, zoomOut, setViewport } = useReactFlow();
  const viewport = useViewport();
  const zoomPercent = Math.round(viewport.zoom * 100);
  const totalButtonRef = useRef<HTMLButtonElement>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const resetZoom = useCallback(() => {
    setViewport({ x: mapCenterX, y: viewport.y, zoom: DEFAULT_ZOOM }, { duration: 180 });
  }, [mapCenterX, setViewport, viewport.y]);

  const toggleStats = useCallback(() => {
    setStatsOpen((value) => !value);
  }, []);

  return (
    <>
      <div className="family-forest-footer" onPointerDown={(event) => event.stopPropagation()}>
        <div className="family-forest-footer__start">
          <button
            type="button"
            className="pill pill-share family-forest-footer__share"
            onClick={onShare}
          >
            <IconShare />
            <span>مشاركة الشجرة</span>
          </button>
          <button
            type="button"
            className="pill pill-print family-forest-footer__print"
            onClick={onPrint}
          >
            <IconPrint />
            <span>طباعة</span>
          </button>
        </div>

        <div className="family-forest-footer__center">
          <div className="family-forest-footer__zoom pill pill-group">
            <button
              type="button"
              className="family-forest-footer__zoom-btn"
              aria-label="تصغير"
              disabled={viewport.zoom <= MIN_ZOOM}
              onClick={() => zoomOut({ duration: 120 })}
            >
              <IconZoomOut />
            </button>
            <span className="family-forest-footer__zoom-label">{zoomPercent}%</span>
            <button
              type="button"
              className="family-forest-footer__zoom-btn"
              aria-label="تكبير"
              disabled={viewport.zoom >= MAX_ZOOM}
              onClick={() => zoomIn({ duration: 120 })}
            >
              <IconZoomIn />
            </button>
            <button
              type="button"
              className="family-forest-footer__reset-btn"
              onClick={resetZoom}
            >
              <IconRecenter />
              <span>إعادة ضبط</span>
            </button>
          </div>

          <button
            ref={totalButtonRef}
            type="button"
            className={`pill family-forest-footer__total-toggle${statsOpen ? ' is-expanded' : ' is-collapsed'}`}
            aria-expanded={statsOpen}
            aria-haspopup="dialog"
            aria-label={`إجمالي أفراد العائلة ${memberCount}`}
            title="إجمالي أفراد العائلة"
            onClick={toggleStats}
          >
            <span className="family-forest-footer__total-toggle-icon" aria-hidden>
              <IconUsers />
            </span>
            <span className="family-forest-footer__total-toggle-count" aria-hidden={!statsOpen}>
              <strong>{memberCount}</strong>
              <span className="family-forest-footer__total-toggle-label">فرداً</span>
            </span>
          </button>
        </div>

        <div className="family-forest-footer__end" aria-hidden />
      </div>

      <ForestFamilyStatsModal
        open={statsOpen}
        anchorRef={totalButtonRef}
        familyName={familyName}
        members={members}
        people={people}
        onClose={() => setStatsOpen(false)}
        onToast={onToast}
      />
    </>
  );
}
