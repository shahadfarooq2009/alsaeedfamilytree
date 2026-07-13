import { type FormEvent, useState } from 'react';
import {
  presetAvatarPhotoUrl,
  resolveMemberPhotoUrl,
} from '../../assets/avatars/catalog';
import type { CreatePersonPayload, Gender } from '../../types/person';
import { createPerson } from '../../services/personService';
import { toApiError } from '../../lib/api';
import { resolveFatherFromName } from '../../utils/resolveFatherFromName';
import { resolveMotherFromName } from '../../utils/resolveMotherFromName';
import { AvatarPickerModal } from './AvatarPickerModal';
import { IconClose, IconGenderFemale, IconGenderMale, IconSaveTree } from './referenceTreeIcons';

interface AddMemberModalProps {
  open: boolean;
  familyId: number;
  isFirstMember: boolean;
  onClose: () => void;
  onSuccess: (personId: number) => void;
}

function namePartsFromFullName(fullName: string) {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || trimmed,
    full_name: trimmed,
    middle_name: null,
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

export function AddMemberModal({
  open,
  familyId,
  isFirstMember,
  onClose,
  onSuccess,
}: AddMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [isLiving, setIsLiving] = useState(true);
  const [deathDate, setDeathDate] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAvatarSrc = selectedAvatarId
    ? resolveMemberPhotoUrl(presetAvatarPhotoUrl(selectedAvatarId))
    : null;

  function resetForm() {
    setFullName('');
    setFatherName('');
    setMotherName('');
    setGender('male');
    setBirthDate('');
    setPhone('');
    setIsLiving(true);
    setDeathDate('');
    setSelectedAvatarId(null);
    setAvatarPickerOpen(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function saveMember(fatherId: number | null, motherId: number | null) {
    const nameParts = namePartsFromFullName(fullName);
    const payload: CreatePersonPayload = {
      ...nameParts,
      gender,
      birth_date: birthDate || null,
      death_date: !isLiving && deathDate ? deathDate : null,
      phone: phone.trim() || null,
      is_living: isLiving,
      is_family_head: isFirstMember,
      father_id: isFirstMember ? null : fatherId,
      mother_id: isFirstMember ? null : motherId,
      photo_url: selectedAvatarId ? presetAvatarPhotoUrl(selectedAvatarId) : null,
    };

    const response = await createPerson(familyId, payload);
    resetForm();
    onSuccess(response.data.id);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!fullName.trim()) {
        setError(isFirstMember ? 'يرجى إدخال الاسم الكامل للمؤسس' : 'يرجى إدخال الاسم الكامل');
        return;
      }

      if (isFirstMember) {
        await saveMember(null, null);
        return;
      }

      if (!fatherName.trim() && !motherName.trim()) {
        setError('يرجى إدخال اسم الأب الكامل أو اسم الأم الكامل');
        return;
      }

      let fatherId: number | null = null;
      let motherId: number | null = null;

      if (fatherName.trim()) {
        const fatherResolution = await resolveFatherFromName(familyId, fatherName);
        if (!fatherResolution.notFound && fatherResolution.fatherId != null) {
          fatherId = fatherResolution.fatherId;
        }
      }

      if (motherName.trim()) {
        const motherResolution = await resolveMotherFromName(familyId, motherName);
        if (!motherResolution.notFound && motherResolution.motherId != null) {
          motherId = motherResolution.motherId;
        }
      }

      if (fatherId == null && motherId == null) {
        setError('لم يتم العثور على الأب أو الأم — أدخل الاسم الكامل كما هو مسجل في الشجرة');
        return;
      }

      await saveMember(fatherId, motherId);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`modal-overlay add-member-overlay${open ? ' open' : ''}`}
        aria-hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <div className="add-member-modal" role="dialog" aria-modal="true" aria-labelledby="addMemberTitle">
          <button type="button" className="modal-close" aria-label="إغلاق" onClick={handleClose}>
            <IconClose />
          </button>

          <div className="add-member-header">
            <div className="add-member-leaf" aria-hidden>
              <svg viewBox="0 0 24 24" className="ico">
                <path d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" fill="currentColor" opacity=".15" />
                <path d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
              </svg>
            </div>
            <h2 id="addMemberTitle">{isFirstMember ? 'إضافة المؤسس' : 'إضافة فرد جديد'}</h2>
            <p>
              {isFirstMember
                ? 'أضف أول فرد في الشجرة — بدون أب — وسيكون أساس العائلة'
                : 'يُربط الفرد تلقائياً إذا وُجد اسم الأب أو الأم في الشجرة'}
            </p>
          </div>

          <form className="add-member-form" onSubmit={handleSubmit}>
            <button
              type="button"
              className={`add-member-photo${selectedAvatarSrc ? ' has-avatar' : ''}`}
              onClick={() => setAvatarPickerOpen(true)}
              aria-label="اختيار صورة شخصية"
            >
              {selectedAvatarSrc ? (
                <img src={selectedAvatarSrc} alt="" className="add-member-photo-img" />
              ) : (
                <>
                  <span className="add-member-photo-icon" aria-hidden>📷</span>
                  <span className="add-member-photo-hint">اختر صورة شخصية</span>
                </>
              )}
            </button>

            <label className="add-member-field">
              <span>الاسم الكامل *</span>
              <input
                type="text"
                placeholder="مثال: شهد فاروق عبدالعزيز"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>

            {!isFirstMember && (
              <>
                <div className="add-member-row add-member-row-2">
                  <label className="add-member-field">
                    <span>اسم الأب الكامل</span>
                    <input
                      type="text"
                      placeholder="مثال: فاروق عبدالعزيز جان محمد"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                    />
                  </label>
                  <label className="add-member-field">
                    <span>اسم الأم الكامل (اختياري)</span>
                    <input
                      type="text"
                      placeholder="مثال: شريفة فاروق عبدالعزيز"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                    />
                  </label>
                </div>
                <p className="add-member-parent-hint">
                  يكفي وجود أحد الوالدين في الشجرة — أدخل الاسم الكامل كما هو مسجل
                </p>
              </>
            )}

            <div className="add-member-row add-member-row-2">
              <div className="add-member-field">
                <span>الجنس</span>
                <div className="add-member-gender" role="radiogroup" aria-label="الجنس">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'male'}
                    className={`gender-option${gender === 'male' ? ' is-selected' : ''}`}
                    onClick={() => setGender('male')}
                  >
                    <IconGenderMale />
                    ذكر
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'female'}
                    className={`gender-option${gender === 'female' ? ' is-selected' : ''}`}
                    onClick={() => setGender('female')}
                  >
                    <IconGenderFemale />
                    أنثى
                  </button>
                </div>
              </div>
              <label className="add-member-field">
                <span>تاريخ الميلاد</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </label>
            </div>

            <label className="add-member-field">
              <span>رقم التواصل (اختياري)</span>
              <input
                type="tel"
                placeholder="أدخل رقم التواصل"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </label>

            <div className="add-member-field">
              <span>حالة الشخص</span>
              <div className="add-member-status">
                <button
                  type="button"
                  className={!isLiving ? 'active' : ''}
                  onClick={() => setIsLiving(false)}
                >
                  متوفى
                </button>
                <button
                  type="button"
                  className={isLiving ? 'active' : ''}
                  onClick={() => setIsLiving(true)}
                >
                  حي
                </button>
              </div>
            </div>

            {!isLiving && (
              <label className="add-member-field">
                <span>تاريخ الوفاة (اختياري)</span>
                <input
                  type="date"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                />
              </label>
            )}

            {error && <p className="add-member-error">{error}</p>}

            <div className="add-member-actions">
              <button type="button" className="add-member-cancel" onClick={handleClose}>
                إلغاء
              </button>
              <button type="submit" className="add-member-save" disabled={submitting}>
                <IconSaveTree />
                {submitting ? 'جاري الحفظ...' : 'حفظ الفرد'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <AvatarPickerModal
        open={avatarPickerOpen}
        selectedAvatarId={selectedAvatarId}
        preferredGender={gender}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={setSelectedAvatarId}
      />
    </>
  );
}
