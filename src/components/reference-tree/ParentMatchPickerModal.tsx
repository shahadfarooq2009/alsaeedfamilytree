import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { getMemberDisplayNameWithFather } from '../../utils/memberDisplayInfo';
import { IconClose } from './referenceTreeIcons';

interface ParentMatchPickerModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  candidates: FamilyMemberInput[];
  lookupMembers?: FamilyMemberInput[];
  familyId?: number;
  onSelect: (member: FamilyMemberInput) => void;
  onClose: () => void;
}

export function ParentMatchPickerModal({
  open,
  title,
  subtitle,
  candidates,
  lookupMembers,
  familyId,
  onSelect,
  onClose,
}: ParentMatchPickerModalProps) {
  if (!open) return null;

  return (
    <div
      className={`modal-overlay add-member-picker-overlay${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="add-member-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parentMatchTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>

        <h3 id="parentMatchTitle" className="add-member-picker-modal__title">{title}</h3>
        <p className="add-member-picker-modal__subtitle">{subtitle}</p>

        <ul className="add-member-picker-modal__list" role="listbox">
          {candidates.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="add-member-picker-modal__option"
                onClick={() => onSelect(member)}
              >
                <strong>
                  {getMemberDisplayNameWithFather(
                    member,
                    lookupMembers ?? candidates,
                    familyId,
                  )}
                </strong>
                <span>الجيل {member.generation}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
