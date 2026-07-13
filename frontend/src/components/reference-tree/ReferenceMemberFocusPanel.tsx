import { forwardRef, useEffect, useRef, useState } from 'react';
import type { PersonDetail, PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { formatRelationLabel } from '../../utils/formatRelationLabel';
import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import { IconClose } from './referenceTreeIcons';

const GENERATION_LABELS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'] as const;
const FOCUS_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface ReferenceMemberFocusPanelProps {
  member: FamilyMemberInput;
  members: FamilyMemberInput[];
  person?: PersonDetail | PersonSummary | null;
  visible: boolean;
  anchor: { left: number; top: number; placement: 'left' | 'right'; arrowTop: number } | null;
  onClose: () => void;
  onViewFullProfile: () => void;
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
      onViewFullProfile,
    },
    ref,
  ) {
    const [contentVisible, setContentVisible] = useState(true);
    const [allowStagger, setAllowStagger] = useState(false);
    const [displayMember, setDisplayMember] = useState(member);
    const [displayPerson, setDisplayPerson] = useState(person);
    const prevMemberIdRef = useRef(member.id);

    const displayFather = members.find((item) => item.id === displayMember.fatherId);
    const displayChildren = members.filter((item) => item.fatherId === displayMember.id);
    const displayLiving = displayPerson?.is_living ?? true;
    const displayPhone = contactNumber(displayPerson);
    const displayPhoto = resolveMemberPhotoUrl(displayPerson?.photo_url ?? null);

    useEffect(() => {
      if (visible) {
        setAllowStagger(true);
        return;
      }
      setAllowStagger(false);
    }, [visible]);

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
          visible ? 'is-visible' : '',
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
                {displayMember.fullName}
              </h2>
              <p className="member-focus-panel-relation">
                {formatRelationLabel(displayMember, members)}
              </p>
            </div>
          </div>

          <dl className="member-focus-panel-meta">
            <div>
              <dt>الجيل</dt>
              <dd>{GENERATION_LABELS[displayMember.generation] ?? displayMember.generation}</dd>
            </div>
            <div>
              <dt>الأب</dt>
              <dd>{displayPerson?.father?.full_name ?? displayFather?.fullName ?? 'غير مسجل'}</dd>
            </div>
            <div>
              <dt>الأبناء المباشرون</dt>
              <dd>{displayChildren.length}</dd>
            </div>
            <div>
              <dt>تاريخ الميلاد</dt>
              <dd>{formatDate(displayPerson?.birth_date)}</dd>
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

          <button
            type="button"
            className="member-focus-panel-action"
            onClick={onViewFullProfile}
          >
            عرض الملف الكامل
          </button>
        </div>
      </aside>
    );
  },
);
