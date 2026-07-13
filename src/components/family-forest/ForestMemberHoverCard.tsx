import { forwardRef, useMemo } from 'react';

import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import type { PersonSummary } from '../../types/person';
import { buildMemberDisplayInfo } from '../../utils/memberDisplayInfo';
import { getMemberSpouseDisplay } from '../../utils/spousePerson';
import type { MemberPanelAnchor } from '../../utils/computeMemberPanelAnchor';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { IconClose, IconEdit, IconTrash } from '../reference-tree/referenceTreeIcons';

const GENERATION_LABELS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'] as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return 'غير مسجل';
  return value.slice(0, 10);
}

interface ForestMemberHoverCardProps {
  member: FamilyMemberInput;
  members: FamilyMemberInput[];
  person?: PersonSummary | null;
  familyId?: number;
  anchor: MemberPanelAnchor | null;
  visible: boolean;
  pinned?: boolean;
  inBranchModal?: boolean;
  editable?: boolean;
  onClose?: () => void;
  onEditRequest?: (memberId: number) => void;
  onDeleteRequest?: (memberId: number) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export const ForestMemberHoverCard = forwardRef<HTMLElement, ForestMemberHoverCardProps>(
  function ForestMemberHoverCard(
    {
      member,
      members,
      person,
      familyId,
      anchor,
      visible,
      pinned = false,
      inBranchModal = false,
      editable = false,
      onClose,
      onEditRequest,
      onDeleteRequest,
      onPointerEnter,
      onPointerLeave,
    },
    ref,
  ) {
    const displayInfo = useMemo(
      () => buildMemberDisplayInfo(member, members, person, familyId),
      [familyId, member, members, person],
    );

    const childrenCount = members.filter((item) => (
      item.fatherId === member.id || item.motherId === member.id
    )).length;
    const isFounder = member.isFamilyHead ?? false;
    const canDelete = editable && Boolean(onDeleteRequest) && !isFounder && childrenCount === 0;
    const isLiving = person?.is_living ?? true;
    const photoSrc = resolveMemberPhotoUrl(person?.photo_url ?? member.photoUrl ?? null);
    const spouse = getMemberSpouseDisplay(member, { person, members, familyId });

    return (
      <aside
        ref={ref}
        className={[
          'forest-member-hover',
          visible ? 'is-visible' : '',
          pinned ? 'is-pinned' : '',
          inBranchModal ? 'is-branch-modal' : '',
          anchor ? `is-anchor-${anchor.placement}` : '',
        ].filter(Boolean).join(' ')}
        role={pinned ? 'dialog' : 'tooltip'}
        aria-hidden={!visible}
        style={{
          ...(anchor ? {
            left: `${anchor.left}px`,
            top: `${anchor.top}px`,
            ['--hover-arrow-top' as string]: `${anchor.arrowTop}px`,
          } : { visibility: 'hidden' }),
        }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <span className="forest-member-hover__arrow" aria-hidden />

        <div className="forest-member-hover__body">
          {pinned && onClose ? (
            <button
              type="button"
              className="forest-member-hover__close"
              aria-label="إغلاق"
              onClick={onClose}
            >
              <IconClose />
            </button>
          ) : null}

          <p className="forest-member-hover__eyebrow">معلومات الفرد</p>

          <div className="forest-member-hover__head">
            {photoSrc ? (
              <img className="forest-member-hover__photo" src={photoSrc} alt="" />
            ) : (
              <div className="forest-member-hover__badge" aria-hidden>
                {member.initial}
              </div>
            )}

            <div className="forest-member-hover__head-text">
              <h3 className="forest-member-hover__name">{displayInfo.displayName}</h3>
            </div>
          </div>

          <span className={`forest-member-hover__status${isLiving ? ' is-living' : ''}`}>
            {isLiving ? 'حي' : 'متوفى'}
          </span>

          <dl className="forest-member-hover__meta">
            {displayInfo.genderLabel ? (
              <div>
                <dt>الجنس</dt>
                <dd>{displayInfo.genderLabel}</dd>
              </div>
            ) : null}

            <div>
              <dt>الجيل</dt>
              <dd>{GENERATION_LABELS[member.generation] ?? member.generation}</dd>
            </div>

            <div>
              <dt>الحالة الاجتماعية</dt>
              <dd>{displayInfo.maritalLabel}</dd>
            </div>

            {spouse ? (
              <div>
                <dt>{spouse.label}</dt>
                <dd>{spouse.name}</dd>
              </div>
            ) : null}

            <div>
              <dt>الأبناء المباشرون</dt>
              <dd>{childrenCount}</dd>
            </div>

            {!isLiving && person?.death_date ? (
              <div>
                <dt>تاريخ الوفاة</dt>
                <dd dir="ltr">{formatDate(person.death_date)}</dd>
              </div>
            ) : null}
          </dl>

          {editable && (onEditRequest || onDeleteRequest) ? (
            <div className="forest-member-hover__actions">
              {onEditRequest ? (
                <button
                  type="button"
                  className="forest-member-hover__edit"
                  onClick={() => onEditRequest(member.id)}
                >
                  <IconEdit />
                  <span>تعديل البيانات</span>
                </button>
              ) : null}

              {onDeleteRequest ? (
                <button
                  type="button"
                  className="forest-member-hover__delete"
                  disabled={!canDelete}
                  onClick={() => onDeleteRequest(member.id)}
                >
                  <IconTrash />
                  <span>حذف الفرد</span>
                </button>
              ) : null}

              {onDeleteRequest && isFounder ? (
                <p className="forest-member-hover__delete-hint">لا يمكن حذف مؤسس العائلة.</p>
              ) : null}

              {onDeleteRequest && !isFounder && childrenCount > 0 ? (
                <p className="forest-member-hover__delete-hint">
                  لا يمكن الحذف — لدى هذا الفرد {childrenCount} من الأبناء المباشرين.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    );
  },
);
