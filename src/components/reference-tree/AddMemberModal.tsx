import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  presetAvatarPhotoUrl,
  resolveMemberPhotoUrl,
} from '../../assets/avatars/catalog';
import type { CreatePersonPayload, Gender } from '../../types/person';
import { createPerson } from '../../services/personService';
import { clearMarriageData, getStoredHusbandNames, saveMarriageData } from '../../utils/spousePerson';
import { toApiError, formatApiErrorMessage } from '../../lib/api';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import {
  buildAddMemberFieldHints,
  buildAddMemberPayload,
  buildResolvedParents,
  matchParentByFullName,
  needsOrphanConfirmation,
  resolveTreePlacement,
  type ParentRole,
} from '../../utils/addMember/resolveAddMemberPlacement';
import { resolveParentsWithMarriage } from '../../utils/addMember/inferParentsFromMarriage';
import { getFamilyMarriages, sanitizeFamilyMarriages } from '../../utils/marriageRegistry';
import { cleanNameInput } from '../../utils/normalizeArabicName';
import { OrphanMemberModal } from './OrphanMemberModal';
import { ParentMatchPickerModal } from './ParentMatchPickerModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import { ParentMemberPicker } from './ParentMemberPicker';
import { ParentNameAutocomplete } from './ParentNameAutocomplete';
import {
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

interface AddMemberModalProps {
  open: boolean;
  familyId: number;
  members: FamilyMemberInput[];
  hasFounder: boolean;
  onClose: () => void;
  onSuccess: (personId: number) => void;
}

interface SaveOverrides {
  father?: FamilyMemberInput | null;
  mother?: FamilyMemberInput | null;
  allowOrphan?: boolean;
}

export function AddMemberModal({
  open,
  familyId,
  members,
  hasFounder,
  onClose,
  onSuccess,
}: AddMemberModalProps) {
  const canBeFounder = !hasFounder;
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [isMarried, setIsMarried] = useState(false);
  const [isFounder, setIsFounder] = useState(canBeFounder && members.length === 0);
  const [gender, setGender] = useState<Gender>('male');
  const [isLiving, setIsLiving] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orphanOpen, setOrphanOpen] = useState(false);
  const [manualParentMode, setManualParentMode] = useState(false);
  const [ambiguity, setAmbiguity] = useState<{
    role: ParentRole;
    candidates: FamilyMemberInput[];
  } | null>(null);
  const [resolvedFather, setResolvedFather] = useState<FamilyMemberInput | null>(null);
  const [resolvedMother, setResolvedMother] = useState<FamilyMemberInput | null>(null);
  const [manualFather, setManualFather] = useState<FamilyMemberInput | null>(null);
  const [manualMother, setManualMother] = useState<FamilyMemberInput | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsFounder(canBeFounder && members.length === 0);
  }, [canBeFounder, members.length, open]);

  const selectedAvatarSrc = useMemo(
    () => (selectedAvatarId ? resolveMemberPhotoUrl(presetAvatarPhotoUrl(selectedAvatarId)) : null),
    [selectedAvatarId],
  );

  const marriages = useMemo(() => {
    if (open) {
      sanitizeFamilyMarriages(familyId, members);
    }
    return getFamilyMarriages(familyId);
  }, [familyId, open, members]);

  const fieldHints = useMemo(
    () => (isFounder || manualParentMode
      ? { fatherHint: null, motherHint: null, placementHint: null }
      : buildAddMemberFieldHints({
        members,
        fatherName,
        motherName,
        resolvedFather,
        resolvedMother,
        marriages,
      })),
    [fatherName, isFounder, manualParentMode, marriages, members, motherName, resolvedFather, resolvedMother],
  );

  const fatherCandidates = useMemo(
    () => members.filter((member) => member.gender === 'male'),
    [members],
  );

  const storedHusbandNames = useMemo(
    () => getStoredHusbandNames(marriages, members),
    [marriages, members],
  );

  const motherCandidates = useMemo(
    () => members.filter((member) => member.gender === 'female'),
    [members],
  );

  function resetForm() {
    setFirstName('');
    setFatherName('');
    setMotherName('');
    setHusbandName('');
    setWifeName('');
    setIsMarried(false);
    setIsFounder(canBeFounder && members.length === 0);
    setGender('male');
    setIsLiving(true);
    setError(null);
    setOrphanOpen(false);
    setManualParentMode(false);
    setAmbiguity(null);
    setResolvedFather(null);
    setResolvedMother(null);
    setManualFather(null);
    setManualMother(null);
    setSelectedAvatarId(null);
    setAvatarPickerOpen(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const resolveParentsForSave = useCallback((overrides: SaveOverrides = {}) => {
    if (isFounder) {
      return buildResolvedParents('', '', { status: 'empty', members: [] }, { status: 'empty', members: [] });
    }

    if (manualParentMode) {
      const father = overrides.father ?? manualFather;
      const mother = overrides.mother ?? manualMother;
      return {
        father,
        mother,
        fatherNameText: null,
        motherNameText: null,
      };
    }

    const fatherMatch = matchParentByFullName(members, fatherName, 'father');
    const motherMatch = matchParentByFullName(members, motherName, 'mother');
    return resolveParentsWithMarriage(
      members,
      marriages,
      fatherName,
      motherName,
      fatherMatch,
      motherMatch,
      overrides.father !== undefined ? overrides.father : null,
      overrides.mother !== undefined ? overrides.mother : null,
    );
  }, [
    fatherName,
    isFounder,
    manualFather,
    manualMother,
    manualParentMode,
    marriages,
    members,
    motherName,
    resolvedFather,
    resolvedMother,
  ]);

  const persistMember = useCallback(async (
    overrides: SaveOverrides = {},
  ) => {
    const resolved = resolveParentsForSave(overrides);
    const placement = isFounder
      ? { treeParentId: null, branchRootId: null, canPlaceOnTree: false }
      : resolveTreePlacement(resolved, members);

    const payload: CreatePersonPayload = {
      ...buildAddMemberPayload({
        firstName,
        gender,
        isLiving,
        isFounder,
        resolved,
        placement,
        allowOrphan: overrides.allowOrphan,
      }),
      photo_url: selectedAvatarId ? presetAvatarPhotoUrl(selectedAvatarId) : null,
    };

    const response = await createPerson(familyId, payload);
    if (isMarried) {
      await saveMarriageData(
        familyId,
        response.data.id,
        gender,
        response.data.full_name,
        husbandName,
        wifeName,
        members,
      );
    }
    resetForm();
    onSuccess(response.data.id);
  }, [
    familyId,
    firstName,
    gender,
    isFounder,
    isLiving,
    members,
    onSuccess,
    resolveParentsForSave,
    selectedAvatarId,
    husbandName,
    wifeName,
    isMarried,
  ]);

  const continueSave = useCallback(async (overrides: SaveOverrides = {}) => {
    setError(null);
    setSubmitting(true);

    try {
      if (isFounder) {
        await persistMember(overrides);
        return;
      }

      if (manualParentMode) {
        const father = overrides.father ?? manualFather;
        const mother = overrides.mother ?? manualMother;
        if (!father && !mother) {
          setError('يرجى اختيار الأب أو الأم من القائمة');
          setSubmitting(false);
          return;
        }
        await persistMember({ ...overrides, father, mother });
        return;
      }

      const father = overrides.father !== undefined ? overrides.father : null;
      const mother = overrides.mother !== undefined ? overrides.mother : null;
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

      if (!overrides.allowOrphan && needsOrphanConfirmation(fatherName, motherName, resolved)) {
        setOrphanOpen(true);
        setSubmitting(false);
        return;
      }

      await persistMember({ ...overrides, father, mother });
    } catch (err) {
      setError(formatApiErrorMessage(toApiError(err)));
    } finally {
      setSubmitting(false);
    }
  }, [
    fatherName,
    isFounder,
    manualFather,
    manualMother,
    manualParentMode,
    marriages,
    members,
    motherName,
    persistMember,
    resolvedFather,
    resolvedMother,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setResolvedFather(null);
    setResolvedMother(null);
    setAmbiguity(null);
    setOrphanOpen(false);
    setError(null);

    const cleanedFirstName = cleanNameInput(firstName);
    if (!cleanedFirstName) {
      setError(isFounder ? 'يرجى إدخال اسم المؤسس' : 'يرجى إدخال الاسم الأول');
      return;
    }

    if (!isFounder) {
      if (manualParentMode) {
        if (!manualFather && !manualMother) {
          setError('يرجى اختيار الأب أو الأم من القائمة');
          return;
        }
      } else {
        const hasFather = cleanNameInput(fatherName).length > 0;
        const hasMother = cleanNameInput(motherName).length > 0;
        if (!hasFather && !hasMother) {
          setError('يرجى إدخال اسم الأب أو الأم الكامل');
          return;
        }
      }
    }

    if (isMarried && gender === 'female' && !cleanNameInput(husbandName)) {
      setError('يرجى إدخال اسم الزوج');
      return;
    }

    if (isMarried && gender === 'male' && !cleanNameInput(husbandName) && !cleanedFirstName) {
      setError('يرجى إدخال اسم الزوج أو اسم الفرد');
      return;
    }

    await continueSave({});
  }

  function handleAmbiguitySelect(member: FamilyMemberInput) {
    if (!ambiguity) return;

    if (ambiguity.role === 'father') {
      setResolvedFather(member);
      setAmbiguity(null);
      void continueSave({ father: member, mother: resolvedMother });
      return;
    }

    setResolvedMother(member);
    setAmbiguity(null);
    void continueSave({ father: resolvedFather, mother: member });
  }

  function handleOrphanConfirm() {
    setOrphanOpen(false);
    void continueSave({ allowOrphan: true });
  }

  function handleOrphanManualSelect() {
    setOrphanOpen(false);
    setManualParentMode(true);
    setFatherName('');
    setMotherName('');
    setResolvedFather(null);
    setResolvedMother(null);
  }

  const ambiguityTitle = ambiguity?.role === 'father'
    ? 'اختر الأب الصحيح'
    : 'اختر الأم الصحيحة';

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
          aria-labelledby="addMemberTitle"
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
            <h2 id="addMemberTitle">{isFounder ? 'إضافة المؤسس' : 'إضافة فرد جديد'}</h2>
            <p>
              {isFounder
                ? 'المؤسس هو جذر الشجرة — لا يحتاج أبًا أو أمًا'
                : manualParentMode
                  ? 'اختر الأب أو الأم من أفراد هذه العائلة'
                  : 'اكتب اسم الأب أو الأم — اختر من القائمة المنسدلة أو اكتفِ بالأب ليُوضَع الابن تلقائياً'}
            </p>
          </div>

          <form className="add-member-form add-member-form--compact" onSubmit={handleSubmit}>
            <label className="add-member-field">
              <FieldLabel icon={<IconPerson />}>
                {isFounder ? 'اسم المؤسس *' : 'الاسم الأول *'}
              </FieldLabel>
              <div className="add-member-name-with-photo">
                <button
                  type="button"
                  className={`add-member-photo-picker${selectedAvatarSrc ? ' has-avatar' : ''}`}
                  onClick={() => setAvatarPickerOpen(true)}
                  aria-label="اختيار صورة شخصية"
                  title="اختيار صورة شخصية"
                >
                  {selectedAvatarSrc ? (
                    <img src={selectedAvatarSrc} alt="" className="add-member-photo-picker-img" />
                  ) : (
                    <IconCamera />
                  )}
                </button>
                <input
                  type="text"
                  placeholder={isFounder ? 'مثال: الفاروق' : 'مثال: أحمد'}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
            </label>

            {canBeFounder ? (
              <div className="add-member-field">
                <FieldLabel icon={<IconUsers />}>هل هذا هو المؤسس؟</FieldLabel>
                <div className="add-member-founder-toggle" role="radiogroup" aria-label="هل هذا هو المؤسس">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isFounder}
                    className={isFounder ? 'active' : ''}
                    onClick={() => {
                      setIsFounder(true);
                      setManualParentMode(false);
                    }}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isFounder}
                    className={!isFounder ? 'active' : ''}
                    onClick={() => setIsFounder(false)}
                  >
                    لا
                  </button>
                </div>
              </div>
            ) : null}

            {!isFounder ? (
              manualParentMode ? (
                <div className="add-member-row add-member-row-2">
                  <ParentMemberPicker
                    label="الأب"
                    labelIcon={<IconGenderMale />}
                    placeholder="ابحث عن الأب..."
                    members={members.filter((member) => member.gender !== 'female')}
                    familyId={familyId}
                    selectedId={manualFather?.id ?? null}
                    onSelect={setManualFather}
                  />
                  <ParentMemberPicker
                    label="الأم"
                    labelIcon={<IconGenderFemale />}
                    placeholder="ابحث عن الأم..."
                    members={members.filter((member) => member.gender !== 'male')}
                    familyId={familyId}
                    selectedId={manualMother?.id ?? null}
                    onSelect={setManualMother}
                  />
                </div>
              ) : (
                <>
                  <div className="add-member-row add-member-row-2">
                    <ParentNameAutocomplete
                      label="اسم الأب كامل"
                      labelIcon={<IconGenderMale />}
                      placeholder="ابدأ بكتابة الاسم الأول..."
                      members={fatherCandidates}
                      lookupMembers={members}
                      familyId={familyId}
                      extraNames={storedHusbandNames}
                      value={fatherName}
                      onChange={setFatherName}
                      onSelectMember={setResolvedFather}
                      hint={fieldHints.fatherHint ? (
                        <p className={`add-member-parent-hint add-member-parent-hint--${fieldHints.fatherHint.variant}`}>
                          {fieldHints.fatherHint.message}
                        </p>
                      ) : null}
                    />

                    <ParentNameAutocomplete
                      label="اسم الأم كامل"
                      labelIcon={<IconGenderFemale />}
                      placeholder="ابدأ بكتابة الاسم الأول..."
                      members={motherCandidates}
                      lookupMembers={members}
                      familyId={familyId}
                      value={motherName}
                      onChange={setMotherName}
                      onSelectMember={setResolvedMother}
                      hint={fieldHints.motherHint ? (
                        <p className={`add-member-parent-hint add-member-parent-hint--${fieldHints.motherHint.variant}`}>
                          {fieldHints.motherHint.message}
                        </p>
                      ) : null}
                    />
                  </div>

                  {fieldHints.placementHint ? (
                    <p className="add-member-placement-hint">{fieldHints.placementHint}</p>
                  ) : null}
                </>
              )
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
                  onClick={() => {
                    setIsMarried(true);
                  }}
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

            {error ? <p className="add-member-error">{error}</p> : null}

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

      <OrphanMemberModal
        open={orphanOpen}
        onConfirmIndependent={handleOrphanConfirm}
        onManualSelect={handleOrphanManualSelect}
        onClose={() => setOrphanOpen(false)}
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
