import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { buildMemberDisplayInfo } from '../../utils/memberDisplayInfo';
import { IconClose } from './referenceTreeIcons';

const GENERATION_LABELS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

interface ReferenceMemberPopoverProps {
  member: FamilyMemberInput;
  members: FamilyMemberInput[];
  person?: PersonSummary | null;
  style: { left: number; top: number; cardHeight?: number };
  onClose: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function ReferenceMemberPopover({
  member,
  members,
  person,
  style,
  onClose,
}: ReferenceMemberPopoverProps) {
  const displayInfo = buildMemberDisplayInfo(member, members, person);
  const father = members.find((item) => item.id === member.fatherId);
  const children = members.filter((item) => item.fatherId === member.id);
  const isLiving = person?.is_living ?? true;

  return (
    <div
      className="member-popover member-popover-from-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="memberPopoverName"
      style={{
        left: `${style.left}px`,
        top: `${style.top}px`,
        ['--card-height' as string]: style.cardHeight ? `${style.cardHeight}px` : undefined,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="member-popover-close" aria-label="إغلاق" onClick={onClose}>
        <IconClose />
      </button>
      <div className="member-popover-badge">{member.initial}</div>
      <h3 className="member-popover-name" id="memberPopoverName">
        {displayInfo.displayName}
      </h3>
      <p className="member-popover-relation">{displayInfo.relationLabel}</p>
      <dl className="member-popover-meta">
        <div>
          <dt>الجيل</dt>
          <dd>{GENERATION_LABELS[member.generation] ?? member.generation}</dd>
        </div>
        <div>
          <dt>الأب</dt>
          <dd>{displayInfo.fatherName ?? person?.father?.full_name ?? father?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>عدد الأبناء</dt>
          <dd>{children.length}</dd>
        </div>
        <div>
          <dt>الحالة</dt>
          <dd>{isLiving ? 'حي' : 'متوفى'}</dd>
        </div>
      </dl>
    </div>
  );
}
