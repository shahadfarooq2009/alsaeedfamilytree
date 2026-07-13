import type { PersonSummary } from '../types/person';
import type { FamilyMemberInput } from './treeLayout/types';
import { findMarriageByPersonId, getFamilyMarriages } from './marriageRegistry';
import { formatMemberNameWithFather, getMemberFirstName } from './normalizeFamilyData';
import { normalizeArabicName } from './normalizeArabicName';
import { formatRelationLabel } from './formatRelationLabel';
import { isPersonMarried } from './spousePerson';

export interface MemberParentNames {
  fatherName: string | null;
  motherName: string | null;
}

export interface MemberDisplayInfo {
  displayName: string;
  fatherName: string | null;
  motherName: string | null;
  genderLabel: string | null;
  maritalLabel: string | null;
  relationLabel: string;
}

function genderLabel(gender?: PersonSummary['gender'] | FamilyMemberInput['gender']): string | null {
  if (gender === 'male') return 'ذكر';
  if (gender === 'female') return 'أنثى';
  if (gender === 'other') return 'آخر';
  return null;
}

function namesConflict(fatherName: string, motherName: string): boolean {
  const fatherKey = normalizeArabicName(fatherName);
  const motherKey = normalizeArabicName(motherName);
  if (!fatherKey || !motherKey) return false;
  return fatherKey === motherKey || fatherKey.includes(motherKey) || motherKey.includes(fatherKey);
}

function marriageFatherName(familyId: number, motherId: number | null | undefined): string | null {
  if (motherId == null) return null;
  const marriage = findMarriageByPersonId(getFamilyMarriages(familyId), motherId);
  return marriage?.husbandName?.trim() || null;
}

export function resolveMemberParentNames(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  person?: PersonSummary | null,
  familyId?: number,
): MemberParentNames {
  const fatherMember = member.fatherId != null
    ? members.find((item) => item.id === member.fatherId) ?? null
    : null;
  const motherMember = member.motherId != null
    ? members.find((item) => item.id === member.motherId) ?? null
    : null;

  const motherName = person?.mother?.full_name
    ?? motherMember?.fullName
    ?? person?.mother_name_text
    ?? member.motherNameText
    ?? null;

  let fatherName = person?.father?.full_name
    ?? (fatherMember && fatherMember.gender !== 'female' ? fatherMember.fullName : null)
    ?? person?.father_name_text
    ?? member.fatherNameText
    ?? null;

  if (fatherName && motherName && namesConflict(fatherName, motherName)) {
    fatherName = person?.father_name_text?.trim()
      ?? member.fatherNameText?.trim()
      ?? (familyId != null ? marriageFatherName(familyId, member.motherId) : null)
      ?? (fatherMember && fatherMember.id !== motherMember?.id && fatherMember.gender !== 'female'
        ? fatherMember.fullName
        : null);
  }

  if (familyId != null) {
    if (!fatherName && member.motherId != null) {
      fatherName = marriageFatherName(familyId, member.motherId);
    }

    if (!motherName && member.fatherId != null) {
      const marriage = findMarriageByPersonId(getFamilyMarriages(familyId), member.fatherId);
      if (marriage?.wifeName) {
        return {
          fatherName: fatherName?.trim() || null,
          motherName: marriage.wifeName.trim() || null,
        };
      }
    }
  }

  return {
    fatherName: fatherName?.trim() || null,
    motherName: motherName?.trim() || null,
  };
}

export function buildMemberRelationLabel(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  person?: PersonSummary | null,
  familyId?: number,
): string {
  const parents = resolveMemberParentNames(member, members, person, familyId);
  const female = member.gender === 'female' || person?.gender === 'female';

  if (parents.fatherName) {
    return female ? `ابنة ${parents.fatherName}` : `ابن ${parents.fatherName}`;
  }

  return formatRelationLabel(member, members);
}

export function buildMemberDisplayInfo(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  person?: PersonSummary | null,
  familyId?: number,
): MemberDisplayInfo {
  const parents = resolveMemberParentNames(member, members, person, familyId);
  const gender = person?.gender ?? member.gender ?? null;
  const married = isPersonMarried(person, familyId, member.id);
  const firstName = getMemberFirstName(member.fullName);

  return {
    displayName: parents.fatherName
      ? formatMemberNameWithFather(firstName, parents.fatherName)
      : firstName,
    fatherName: parents.fatherName,
    motherName: parents.motherName,
    genderLabel: genderLabel(gender),
    maritalLabel: married ? 'متزوج' : 'غير متزوج',
    relationLabel: buildMemberRelationLabel(member, members, person, familyId),
  };
}

/** Dropdown / picker label: first name + father's full name. */
export function getMemberDisplayNameWithFather(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  familyId?: number,
): string {
  return buildMemberDisplayInfo(member, members, null, familyId).displayName;
}
