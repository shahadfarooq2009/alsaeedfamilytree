import { forwardRef, useEffect, useRef, useState } from 'react';
import type { PersonDetail, PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { buildMemberDisplayInfo } from '../../utils/memberDisplayInfo';
import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import { IconClose } from './referenceTreeIcons';

const GENERATION_LABELS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'] as const;
const FOCUS_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const PANEL_EXIT_MS = 280;

interface ReferenceMemberFocusPanelProps {
  member: FamilyMemberInput;
  members: FamilyMemberInput[];
  person?: PersonDetail | PersonSummary | null;
  visible: boolean;
  anchor: { left: number; top: number; placement: 'left' | 'right'; arrowTop: number } | null;
  onClose: () => void;
  onExitComplete?: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'غير مسجل';
  return value.slice(0, 10);
}

function contactNumber(person: PersonDetail | PersonSummary | null | undefined): string | null {
  if (!person) return null;
  if ('phone' in person && person.phone?.trim()) return person.phone.trim();
  if ('whatsapp_number' in person && person.whatsapp_number?.trim()) return person.whatsapp_number.trim();
  return null;
}

export const ReferenceMemberFocusPanel = forwardRef<HTMLElement, ReferenceMemberFocusPanelProps>(
  function ReferenceMemberFocusPanel(
    {
      member,
      members,
      person,
      visible,
      anchor,
      onClose,
      onExitComplete,
    },
    ref,
  ) {
    const [contentVisible, setContentVisible] = useState(true);
    const [allowStagger, setAllowStagger] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [displayMember, setDisplayMember] = useState(member);
    const [displayPerson, setDisplayPerson] = useState(person);
    const prevMemberIdRef = useRef(member.id);
    const wasVisibleRef = useRef(visible);

    const displayInfo = buildMemberDisplayInfo(displayMember, members, displayPerson ?? null);
    const displayName = displayInfo.displayName;
    const displayChildren = members.filter((item) => item.fatherId === displayMember.id);
    const displayLiving = displayPerson?.is_living ?? true;
    const displayPhone = contactNumber(displayPerson);
    const displayPhoto = resolveMemberPhotoUrl(displayPerson?.photo_url ?? null);

    useEffect(() => {
      if (visible) {
        setIsExiting(false);
        wasVisibleRef.current = true;
        setAllowStagger(true);
        return;
      }

      setAllowStagger(false);
      if (!wasVisibleRef.current) return undefined;

      wasVisibleRef.current = false;
      setIsExiting(true);
      const timer = window.setTimeout(() => {
        setIsExiting(false);
        onExitComplete?.();
      }, PANEL_EXIT_MS);

      return () => window.clearTimeout(timer);
    }, [onExitComplete, visible]);

    useEffect(() => {
      if (prevMemberIdRef.current === member.id) {
        setDisplayMember(member);
        setDisplayPerson(person);
        return undefined;
      }

      setAllowStagger(false);
      setContentVisible(false);
      const timer = window.setTimeout(() => {
        prevMemberIdRef.current = member.id;
        setDisplayMember(member);
        setDisplayPerson(person);
        setContentVisible(true);
      }, 180);

      return () => window.clearTimeout(timer);
    }, [member, person]);

    return (
      <aside
        ref={ref}
        className={[
          'member-focus-panel',
          visible && !isExiting ? 'is-visible' : '',
          isExiting ? 'is-exiting' : '',
          anchor ? `is-anchor-${anchor.placement}` : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="false"
        aria-labelledby="memberFocusPanelName"
        tabIndex={-1}
        style={anchor ? {
          left: `${anchor.left}px`,
          top: `${anchor.top}px`,
          ['--arrow-top' as string]: `${anchor.arrowTop}px`,
        } : { visibility: 'hidden' }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="member-focus-panel-arrow" aria-hidden />

        <button
          type="button"
          className="member-focus-panel-close"
          aria-label="إغلاق"
          onClick={onClose}
        >
          <IconClose />
        </button>

        <div
          className={[
            'member-focus-panel-body',
            contentVisible ? '' : 'is-switching',
            allowStagger && contentVisible ? 'is-stagger-in' : '',
          ].filter(Boolean).join(' ')}
          style={{ transitionTimingFunction: FOCUS_EASE }}
        >
          <p className="member-focus-panel-title">تفاصيل الفرد</p>

          <div className="member-focus-panel-head">
            {displayPhoto ? (
              <img
                className="member-focus-panel-photo"
                src={displayPhoto}
                alt=""
              />
            ) : (
              <div className="member-focus-panel-badge" aria-hidden>
                {displayMember.initial}
              </div>
            )}

            <div className="member-focus-panel-head-text">
              <h2 className="member-focus-panel-name" id="memberFocusPanelName">
                {displayName}
              </h2>
              <p className="member-focus-panel-relation">
                {displayInfo.relationLabel}
              </p>
            </div>
          </div>

          <dl className="member-focus-panel-meta">
            <div>
              <dt>الجيل</dt>
              <dd>{GENERATION_LABELS[displayMember.generation] ?? displayMember.generation}</dd>
            </div>
            <div>
              <dt>الأبناء المباشرون</dt>
              <dd>{displayChildren.length}</dd>
            </div>
            <div>
              <dt>الحالة</dt>
              <dd>{displayLiving ? 'حي' : 'متوفى'}</dd>
            </div>
            {!displayLiving && displayPerson?.death_date ? (
              <div>
                <dt>تاريخ الوفاة</dt>
                <dd>{formatDate(displayPerson.death_date)}</dd>
              </div>
            ) : null}
            {displayPhone ? (
              <div>
                <dt>رقم التواصل</dt>
                <dd dir="ltr">{displayPhone}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </aside>
    );
  },
);
