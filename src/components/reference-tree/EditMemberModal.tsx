import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  presetAvatarPhotoUrl,
  resolveMemberPhotoUrl,
} from '../../assets/avatars/catalog';
import type { Gender, PersonSummary } from '../../types/person';
import { updatePerson } from '../../services/personService';
import { toApiError } from '../../lib/api';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { cleanNameInput } from '../../utils/normalizeArabicName';
import { getMemberDisplayNameWithFather, resolveMemberParentNames } from '../../utils/memberDisplayInfo';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import {
  formatDateForInput,
  normalizeDateInput,
} from '../../utils/parseMemberNameInput';
import {
  clearMarriageData,
  getMarriageFieldValues,
  getStoredHusbandNames,
  isPersonMarried,
  saveMarriageData,
} from '../../utils/spousePerson';
import { getFamilyMarriages } from '../../utils/marriageRegistry';
import {
  buildUpdateMemberPayload,
  matchParentByFullName,
  resolveTreePlacement,
} from '../../utils/addMember/resolveAddMemberPlacement';
import { resolveParentsWithMarriage } from '../../utils/addMember/inferParentsFromMarriage';
import { AvatarPickerModal } from './AvatarPickerModal';
import { ParentMatchPickerModal } from './ParentMatchPickerModal';
import { ParentNameAutocomplete } from './ParentNameAutocomplete';
import {
  IconCalendar,
  IconCamera,
  IconClose,
  IconGenderFemale,
  IconGenderMale,
  IconHeartPulse,
  IconMemorial,
  IconPerson,
  IconSaveTree,
  IconUsers,
} from './referenceTreeIcons';

function FieldLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="add-member-field__label">
      <span className="add-member-field__label-icon" aria-hidden>
        {icon}
      </span>
      <span className="add-member-field__label-text">{children}</span>
    </span>
  );
}

interface EditMemberModalProps {
  open: boolean;
  familyId: number;
  member: FamilyMemberInput | null;
  person: PersonSummary | null;
  members: FamilyMemberInput[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMemberModal({
  open,
  familyId,
  member,
  person,
  members,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const isFounder = member?.isFamilyHead ?? false;
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [isMarried, setIsMarried] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [isLiving, setIsLiving] = useState(true);
  const [deathDate, setDeathDate] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [resolvedFather, setResolvedFather] = useState<FamilyMemberInput | null>(null);
  const [resolvedMother, setResolvedMother] = useState<FamilyMemberInput | null>(null);
  const [ambiguity, setAmbiguity] = useState<{
    role: 'father' | 'mother';
    candidates: FamilyMemberInput[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marriages = useMemo(
    () => getFamilyMarriages(familyId),
    [familyId, member?.id, open],
  );

  const fatherCandidates = useMemo(
    () => members.filter((item) => item.gender === 'male'),
    [members],
  );

  const motherCandidates = useMemo(
    () => members.filter((item) => item.gender === 'female'),
    [members],
  );

  const storedHusbandNames = useMemo(
    () => getStoredHusbandNames(marriages, members),
    [marriages, members],
  );

  useEffect(() => {
    if (!open || !member) return;

    const father = member.fatherId != null
      ? members.find((item) => item.id === member.fatherId) ?? null
      : null;
    const mother = member.motherId != null
      ? members.find((item) => item.id === member.motherId) ?? null
      : null;
    const parents = resolveMemberParentNames(member, members, person, familyId);
    const personGender = person?.gender ?? member.gender ?? 'male';
    const personFullName = member.fullName.trim();
    const marriageValues = getMarriageFieldValues(
      personFullName,
      personGender,
      person,
      familyId,
      member.id,
    );

    setFirstName(isFounder ? member.fullName.trim() : getMemberFirstName(member.fullName));
    setFatherName(
      father
        ? getMemberDisplayNameWithFather(father, members, familyId)
        : (parents.fatherName ?? ''),
    );
    setMotherName(
      mother
        ? getMemberDisplayNameWithFather(mother, members, familyId)
        : (parents.motherName ?? ''),
    );
    setResolvedFather(father);
    setResolvedMother(mother);
    setHusbandName(marriageValues.husbandName);
    setWifeName(marriageValues.wifeName);
    setIsMarried(isPersonMarried(person, familyId, member.id));
    setGender(personGender);
    setIsLiving(person?.is_living ?? true);
    setDeathDate(formatDateForInput(person?.death_date));
    setSelectedAvatarId(null);
    setAvatarPickerOpen(false);
    setAmbiguity(null);
    setError(null);
  }, [familyId, isFounder, member, members, open, person]);

  const photoSrc = useMemo(() => {
    if (selectedAvatarId) {
      return resolveMemberPhotoUrl(presetAvatarPhotoUrl(selectedAvatarId));
    }
    return resolveMemberPhotoUrl(person?.photo_url ?? member?.photoUrl ?? null);
  }, [member?.photoUrl, person?.photo_url, selectedAvatarId]);

  function handleClose() {
    setError(null);
    setAmbiguity(null);
    onClose();
  }

  const persistUpdate = useCallback(async (
    overrides: { father?: FamilyMemberInput | null; mother?: FamilyMemberInput | null } = {},
  ) => {
    if (!member) return;

    const trimmedName = cleanNameInput(firstName);
    const father = overrides.father ?? resolvedFather;
    const mother = overrides.mother ?? resolvedMother;
    const fatherMatch = matchParentByFullName(members, fatherName, 'father');
    const motherMatch = matchParentByFullName(members, motherName, 'mother');

    if (!overrides.father && fatherMatch.status === 'multiple') {
      setAmbiguity({ role: 'father', candidates: fatherMatch.members });
      setSubmitting(false);
      return;
    }

    if (!overrides.mother && motherMatch.status === 'multiple') {
      setAmbiguity({ role: 'mother', candidates: motherMatch.members });
      setSubmitting(false);
      return;
    }

    const resolved = resolveParentsWithMarriage(
      members,
      marriages,
      fatherName,
      motherName,
      fatherMatch,
      motherMatch,
      father,
      mother,
    );

    const placement = resolveTreePlacement(resolved, members);
    const payload = buildUpdateMemberPayload({
      firstName: trimmedName,
      gender,
      isLiving,
      deathDate: isLiving ? null : normalizeDateInput(deathDate),
      resolved,
      placement,
    });

    if (isFounder) {
      payload.full_name = trimmedName;
    }

    if (selectedAvatarId) {
      payload.photo_url = presetAvatarPhotoUrl(selectedAvatarId);
    }

    await updatePerson(familyId, member.id, payload);

    if (isMarried) {
      await saveMarriageData(
        familyId,
        member.id,
        gender,
        isFounder ? trimmedName : payload.full_name ?? member.fullName,
        husbandName,
        wifeName,
        members,
      );
    } else {
      await clearMarriageData(familyId, member.id);
    }

    onSuccess();
    handleClose();
  }, [
    deathDate,
    familyId,
    fatherName,
    firstName,
    gender,
    husbandName,
    isFounder,
    isLiving,
    isMarried,
    marriages,
    member,
    members,
    motherName,
    onSuccess,
    resolvedFather,
    resolvedMother,
    selectedAvatarId,
    wifeName,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!member) return;

    const trimmedName = cleanNameInput(firstName);
    if (!trimmedName) {
      setError(isFounder ? 'يرجى إدخال اسم المؤسس' : 'يرجى إدخال الاسم الأول');
      return;
    }

    if (!isFounder) {
      const hasFather = cleanNameInput(fatherName).length > 0;
      const hasMother = cleanNameInput(motherName).length > 0;
      if (!hasFather && !hasMother) {
        setError('يرجى إدخال اسم الأب أو الأم الكامل');
        return;
      }
    }

    if (isMarried && gender === 'female' && !cleanNameInput(husbandName)) {
      setError('يرجى إدخال اسم الزوج');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await persistUpdate();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAmbiguitySelect(selected: FamilyMemberInput) {
    if (!ambiguity) return;

    const role = ambiguity.role;
    setAmbiguity(null);

    if (role === 'father') {
      setResolvedFather(selected);
      setFatherName(getMemberDisplayNameWithFather(selected, members, familyId));
    } else {
      setResolvedMother(selected);
      setMotherName(getMemberDisplayNameWithFather(selected, members, familyId));
    }

    setSubmitting(true);
    setError(null);

    void persistUpdate(role === 'father' ? { father: selected } : { mother: selected })
      .catch((err) => {
        setError(toApiError(err).message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  if (!member) return null;

  const ambiguityTitle = ambiguity?.role === 'father'
    ? 'اختر الأب المناسب'
    : 'اختر الأم المناسبة';
  const ambiguitySubtitle = ambiguity?.role === 'father'
    ? 'وُجد أكثر من تطابق لاسم الأب. اختر الشخص المناسب.'
    : 'وُجد أكثر من تطابق لاسم الأم. اختر الشخص المناسب.';

  return (
    <>
      <div
        className={`modal-overlay add-member-overlay${open ? ' open' : ''}`}
        aria-hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <div
          className="add-member-modal add-member-modal--simple"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editMemberTitle"
        >
          <button type="button" className="modal-close" aria-label="إغلاق" onClick={handleClose}>
            <IconClose />
          </button>

          <div className="add-member-header add-member-header--compact">
            <div className="add-member-leaf" aria-hidden>
              <svg viewBox="0 0 24 24" className="ico">
                <path d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" fill="currentColor" opacity=".15" />
                <path d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
              </svg>
            </div>
            <h2 id="editMemberTitle">تعديل البيانات</h2>
            <p>عدّل بيانات الفرد واحفظ التغييرات على الشجرة</p>
          </div>

          <form className="add-member-form add-member-form--compact" onSubmit={handleSubmit}>
            <label className="add-member-field">
              <FieldLabel icon={<IconPerson />}>
                {isFounder ? 'الاسم *' : 'الاسم الأول *'}
              </FieldLabel>
              <div className="add-member-name-with-photo">
                <button
                  type="button"
                  className={`add-member-photo-picker${photoSrc ? ' has-avatar' : ''}`}
                  onClick={() => setAvatarPickerOpen(true)}
                  aria-label="اختيار صورة شخصية"
                  title="اختيار صورة شخصية"
                >
                  {photoSrc ? (
                    <img src={photoSrc} alt="" className="add-member-photo-picker-img" />
                  ) : (
                    <IconCamera />
                  )}
                </button>
                <input
                  type="text"
                  placeholder={isFounder ? 'مثال: محمد السعيد' : 'مثال: أحمد'}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
            </label>

            {!isFounder ? (
              <div className="add-member-row add-member-row-2">
                <ParentNameAutocomplete
                  label="اسم الأب كامل"
                  labelIcon={<IconGenderMale />}
                  placeholder="ابدأ بكتابة اسم الأب..."
                  members={fatherCandidates}
                  lookupMembers={members}
                  familyId={familyId}
                  extraNames={storedHusbandNames}
                  value={fatherName}
                  onChange={(value) => {
                    setFatherName(value);
                    setResolvedFather(null);
                  }}
                  onSelectMember={setResolvedFather}
                />

                <ParentNameAutocomplete
                  label="اسم الأم كامل"
                  labelIcon={<IconGenderFemale />}
                  placeholder="ابدأ بكتابة اسم الأم..."
                  members={motherCandidates}
                  lookupMembers={members}
                  familyId={familyId}
                  value={motherName}
                  onChange={(value) => {
                    setMotherName(value);
                    setResolvedMother(null);
                  }}
                  onSelectMember={setResolvedMother}
                />
              </div>
            ) : null}

            <div className="add-member-row add-member-row-2">
              <div className="add-member-field">
                <FieldLabel icon={<IconUsers />}>الجنس</FieldLabel>
                <div className="add-member-gender" role="radiogroup" aria-label="الجنس">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'male'}
                    className={`gender-option${gender === 'male' ? ' is-selected' : ''}`}
                    onClick={() => {
                      setGender('male');
                    }}
                  >
                    <IconGenderMale />
                    ذكر
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'female'}
                    className={`gender-option${gender === 'female' ? ' is-selected' : ''}`}
                    onClick={() => {
                      setGender('female');
                    }}
                  >
                    <IconGenderFemale />
                    أنثى
                  </button>
                </div>
              </div>

              <div className="add-member-field">
                <FieldLabel icon={<IconHeartPulse />}>الحالة</FieldLabel>
                <div className="add-member-status">
                  <button
                    type="button"
                    className={isLiving ? 'active' : ''}
                    onClick={() => setIsLiving(true)}
                  >
                    <IconHeartPulse />
                    حي
                  </button>
                  <button
                    type="button"
                    className={!isLiving ? 'active' : ''}
                    onClick={() => setIsLiving(false)}
                  >
                    <IconMemorial />
                    متوفى
                  </button>
                </div>
              </div>
            </div>

            <div className="add-member-field">
              <FieldLabel icon={<IconHeartPulse />}>الحالة الاجتماعية</FieldLabel>
              <div className="add-member-marital" role="radiogroup" aria-label="الحالة الاجتماعية">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isMarried}
                  className={`marital-option${isMarried ? ' is-selected' : ''}`}
                  onClick={() => setIsMarried(true)}
                >
                  <IconUsers />
                  متزوج
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isMarried}
                  className={`marital-option${!isMarried ? ' is-selected' : ''}`}
                  onClick={() => {
                    setIsMarried(false);
                    setHusbandName('');
                    setWifeName('');
                  }}
                >
                  <IconPerson />
                  غير متزوج
                </button>
              </div>
            </div>

            {isMarried ? (
              <div className="add-member-row add-member-row-2">
                <ParentNameAutocomplete
                  label="اسم الزوج"
                  labelIcon={<IconGenderMale />}
                  placeholder="ابدأ بكتابة اسم الزوج..."
                  members={fatherCandidates}
                  lookupMembers={members}
                  familyId={familyId}
                  extraNames={storedHusbandNames}
                  value={husbandName}
                  onChange={setHusbandName}
                />

                <label className="add-member-field">
                  <FieldLabel icon={<IconGenderFemale />}>اسم الزوجة (اختياري)</FieldLabel>
                  <input
                    type="text"
                    placeholder="يُستخدم اسم الفرد إن تُرك فارغًا"
                    value={wifeName}
                    onChange={(event) => setWifeName(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
            ) : null}

            {!isLiving ? (
              <label className="add-member-field">
                <FieldLabel icon={<IconCalendar />}>تاريخ الوفاة</FieldLabel>
                <input
                  type="date"
                  value={deathDate}
                  dir="ltr"
                  onChange={(event) => setDeathDate(event.target.value)}
                />
              </label>
            ) : null}

            {error ? <p className="add-member-error">{error}</p> : null}

            <div className="add-member-actions">
              <button type="button" className="add-member-cancel" onClick={handleClose}>
                إلغاء
              </button>
              <button type="submit" className="add-member-save" disabled={submitting}>
                <IconSaveTree />
                {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ParentMatchPickerModal
        open={ambiguity != null}
        title={ambiguityTitle}
        subtitle={ambiguitySubtitle}
        candidates={ambiguity?.candidates ?? []}
        lookupMembers={members}
        familyId={familyId}
        onSelect={handleAmbiguitySelect}
        onClose={() => setAmbiguity(null)}
      />

      <AvatarPickerModal
        open={avatarPickerOpen}
        selectedAvatarId={selectedAvatarId}
        preferredGender={gender}
        stacked
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={setSelectedAvatarId}
      />
    </>
  );
}
