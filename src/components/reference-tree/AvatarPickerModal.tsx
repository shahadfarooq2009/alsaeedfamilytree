import type { Gender } from '../../types/person';
import { findPresetAvatar, PRESET_AVATARS } from '../../assets/avatars/catalog';
import { IconClose } from './referenceTreeIcons';

interface AvatarPickerModalProps {
  open: boolean;
  selectedAvatarId: string | null;
  preferredGender?: Gender | null;
  /** When true, stacks above add-member modal (higher z-index). */
  stacked?: boolean;
  onClose: () => void;
  onSelect: (avatarId: string) => void;
}

export function AvatarPickerModal({
  open,
  selectedAvatarId,
  preferredGender,
  stacked = false,
  onClose,
  onSelect,
}: AvatarPickerModalProps) {
  const avatars = preferredGender
    ? [
      ...PRESET_AVATARS.filter((avatar) => avatar.gender === preferredGender),
      ...PRESET_AVATARS.filter((avatar) => avatar.gender !== preferredGender),
    ]
    : PRESET_AVATARS;

  function handleSelect(avatarId: string) {
    onSelect(avatarId);
    onClose();
  }

  return (
    <div
      className={`modal-overlay avatar-picker-overlay${open ? ' open' : ''}${stacked ? ' is-stacked' : ''}`}
      aria-hidden={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="avatar-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatarPickerTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>

        <div className="avatar-picker-header">
          <h2 id="avatarPickerTitle">اختر صورة شخصية</h2>
          <p>اختر أحد الأشكال — ستظهر في الدائرة فوق اسم الفرد في الشجرة</p>
        </div>

        <div className="avatar-picker-grid" role="listbox" aria-label="صور شخصية">
          {avatars.map((avatar) => {
            const isSelected = selectedAvatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`avatar-picker-item${isSelected ? ' is-selected' : ''}`}
                onClick={() => handleSelect(avatar.id)}
              >
                <span className="avatar-picker-ring">
                  <img src={avatar.src} alt="" className="avatar-picker-image" />
                </span>
              </button>
            );
          })}
        </div>

        {selectedAvatarId && findPresetAvatar(`preset:${selectedAvatarId}`) ? (
          <p className="avatar-picker-selected-hint">تم اختيار صورة — يمكنك تغييرها أو إغلاق النافذة</p>
        ) : null}
      </div>
    </div>
  );
}
