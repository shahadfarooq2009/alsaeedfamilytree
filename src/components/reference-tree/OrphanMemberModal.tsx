import { IconClose } from './referenceTreeIcons';

interface OrphanMemberModalProps {
  open: boolean;
  onConfirmIndependent: () => void;
  onManualSelect: () => void;
  onClose: () => void;
}

export function OrphanMemberModal({
  open,
  onConfirmIndependent,
  onManualSelect,
  onClose,
}: OrphanMemberModalProps) {
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
        className="add-member-picker-modal add-member-picker-modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orphanMemberTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>

        <h3 id="orphanMemberTitle" className="add-member-picker-modal__title">
          لم يتم العثور على الأب أو الأم
        </h3>
        <p className="add-member-picker-modal__subtitle">
          لم يتم العثور على الأب أو الأم داخل هذه العائلة. هل تريد إضافته كشخص مستقل أو اختيار الأب/الأم يدويًا؟
        </p>

        <div className="add-member-picker-modal__actions">
          <button type="button" className="add-member-cancel" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="add-member-cancel" onClick={onManualSelect}>
            اختيار يدوي
          </button>
          <button type="button" className="add-member-save" onClick={onConfirmIndependent}>
            إضافة كشخص مستقل
          </button>
        </div>
      </div>
    </div>
  );
}
