import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { formatRelationLabel } from '../../utils/formatRelationLabel';
import { IconClose } from './referenceTreeIcons';

const GENERATION_LABELS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

interface ReferencePersonModalProps {
  member: FamilyMemberInput | null;
  members: FamilyMemberInput[];
  open: boolean;
  onClose: () => void;
}

export function ReferencePersonModal({
  member,
  members,
  open,
  onClose,
}: ReferencePersonModalProps) {
  if (!member) {
    return (
      <div className={`modal-overlay${open ? ' open' : ''}`} id="modalOverlay" aria-hidden>
        <div className="modal" id="modal" role="dialog" aria-modal="true" />
      </div>
    );
  }

  const father = members.find((item) => item.id === member.fatherId);
  const children = members.filter((item) => item.fatherId === member.id);

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      id="modalOverlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" id="modal" role="dialog" aria-modal="true">
        <button type="button" className="modal-close" id="modalClose" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>
        <div className="modal-badge" id="modalBadge">
          {member.initial}
        </div>
        <h3 className="modal-name" id="modalName">
          {member.fullName}
        </h3>
        <p className="modal-relation" id="modalRelation">
          {formatRelationLabel(member, members)}
        </p>
        <dl className="modal-meta" id="modalMeta">
          <div>
            <dt>الجيل</dt>
            <dd>{GENERATION_LABELS[member.generation] ?? member.generation}</dd>
          </div>
          <div>
            <dt>الأب</dt>
            <dd>{father ? father.fullName : '—'}</dd>
          </div>
          <div>
            <dt>عدد الأبناء</dt>
            <dd>{children.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
