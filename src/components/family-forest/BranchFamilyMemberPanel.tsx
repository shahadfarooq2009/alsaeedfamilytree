import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { getBranchBoardDirectChildren } from '../../utils/familyForest/buildBranchFamilyBoard';
import { IconClose } from '../reference-tree/referenceTreeIcons';

interface BranchFamilyMemberPanelProps {
  member: FamilyMemberInput;
  members: FamilyMemberInput[];
  branchHeadId: number;
  isInlineExpanded: boolean;
  onClose: () => void;
  onShowFamily: () => void;
  onHideFamily: () => void;
  onEditMember?: (memberId: number) => void;
}

export function BranchFamilyMemberPanel({
  member,
  members,
  branchHeadId,
  isInlineExpanded,
  onClose,
  onShowFamily,
  onHideFamily,
  onEditMember,
}: BranchFamilyMemberPanelProps) {
  const memberById = new Map(members.map((item) => [item.id, item]));
  const father = member.fatherId != null ? memberById.get(member.fatherId) : undefined;
  const mother = member.motherId != null ? memberById.get(member.motherId) : undefined;
  const directChildren = getBranchBoardDirectChildren(members, branchHeadId, member.id);
  const photoSrc = resolveMemberPhotoUrl(member.photoUrl ?? null);
  const hasChildren = directChildren.length > 0;

  return (
    <aside className="branch-family-member-panel" aria-label="تفاصيل الفرد">
      <div className="branch-family-member-panel__header">
        <h3 className="branch-family-member-panel__title">تفاصيل الفرد</h3>
        <button
          type="button"
          className="branch-family-member-panel__close"
          aria-label="إغلاق"
          onClick={onClose}
        >
          <IconClose />
        </button>
      </div>

      <div className="branch-family-member-panel__body">
        <div className="branch-family-member-panel__head">
          {photoSrc ? (
            <img className="branch-family-member-panel__photo" src={photoSrc} alt="" />
          ) : (
            <div className="branch-family-member-panel__badge" aria-hidden>
              {member.initial || getMemberFirstName(member.fullName).charAt(0)}
            </div>
          )}
          <p className="branch-family-member-panel__name">{member.fullName}</p>
        </div>

        <dl className="branch-family-member-panel__meta">
          <div>
            <dt>الأب</dt>
            <dd>{father?.fullName ?? 'غير مسجل'}</dd>
          </div>
          <div>
            <dt>الأم</dt>
            <dd>{mother?.fullName ?? 'غير مسجل'}</dd>
          </div>
          <div>
            <dt>عدد الأبناء</dt>
            <dd>{directChildren.length}</dd>
          </div>
        </dl>

        {directChildren.length > 0 ? (
          <div className="branch-family-member-panel__children-list">
            <p className="branch-family-member-panel__children-label">الأبناء المباشرون</p>
            <ul>
              {directChildren.map((child) => (
                <li key={child.id}>{getMemberFirstName(child.fullName)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="branch-family-member-panel__no-children">لا يوجد أبناء مسجلون</p>
        )}

        <div className="branch-family-member-panel__actions">
          <button
            type="button"
            className="branch-family-member-panel__btn is-secondary"
            onClick={() => onEditMember?.(member.id)}
          >
            تعديل
          </button>

          {hasChildren ? (
            isInlineExpanded ? (
              <button
                type="button"
                className="branch-family-member-panel__btn is-muted"
                onClick={onHideFamily}
              >
                إخفاء الأبناء
              </button>
            ) : (
              <button
                type="button"
                className="branch-family-member-panel__btn is-primary"
                onClick={onShowFamily}
              >
                عرض عائلة هذا الشخص
              </button>
            )
          ) : null}
        </div>
      </div>
    </aside>
  );
}
