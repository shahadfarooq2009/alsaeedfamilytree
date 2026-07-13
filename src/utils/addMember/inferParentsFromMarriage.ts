import type { MarriageRecord } from '../marriageRegistry';
import {
  findMarriageByHusbandName,
  findMarriageByPersonId,
  findMarriageByWifeName,
} from '../marriageRegistry';
import { cleanNameInput } from '../normalizeArabicName';
import type { FamilyMemberInput } from '../treeLayout/types';
import {
  buildResolvedParents,
  matchParentByFullName,
  type ParentMatchResult,
  type ParentRole,
  type ResolvedParents,
} from './resolveAddMemberPlacement';

function memberFromId(
  members: FamilyMemberInput[],
  id: number | null,
): FamilyMemberInput | null {
  if (id == null) return null;
  return members.find((member) => member.id === id) ?? null;
}

function isValidLinkedParent(
  member: FamilyMemberInput | null | undefined,
  role: ParentRole,
): member is FamilyMemberInput {
  if (!member) return false;
  if (role === 'father') return member.gender === 'male';
  if (role === 'mother') return member.gender === 'female';
  return false;
}

function memberFromName(
  members: FamilyMemberInput[],
  name: string,
  role: ParentRole,
): FamilyMemberInput | null {
  const match = matchParentByFullName(members, name, role);
  const member = match.status === 'single' ? match.members[0] : null;
  return isValidLinkedParent(member, role) ? member : null;
}

function resolveLinkedParentFromMarriage(
  members: FamilyMemberInput[],
  marriage: MarriageRecord,
  role: ParentRole,
): FamilyMemberInput | null {
  const memberId = role === 'father' ? marriage.husbandId : marriage.wifeId;
  const memberName = role === 'father' ? marriage.husbandName : marriage.wifeName;
  const fromId = memberFromId(members, memberId);
  if (isValidLinkedParent(fromId, role)) {
    return fromId;
  }
  return memberFromName(members, memberName, role);
}

function resolveSpouseMember(
  members: FamilyMemberInput[],
  marriage: MarriageRecord,
  role: ParentRole,
): FamilyMemberInput | null {
  return resolveLinkedParentFromMarriage(members, marriage, role);
}

export function inferSpouseFromMarriage(
  members: FamilyMemberInput[],
  marriages: MarriageRecord[],
  person: FamilyMemberInput | null,
  personName: string,
  role: ParentRole,
): FamilyMemberInput | null {
  if (person && isValidLinkedParent(person, role)) {
    const marriage = findMarriageByPersonId(marriages, person.id);
    if (marriage) {
      const spouseRole: ParentRole = role === 'father' ? 'mother' : 'father';
      return resolveSpouseMember(members, marriage, spouseRole);
    }
  }

  const cleanedName = cleanNameInput(personName);
  if (!cleanedName) return null;

  const marriage = role === 'father'
    ? findMarriageByHusbandName(marriages, cleanedName)
    : findMarriageByWifeName(marriages, cleanedName);

  if (!marriage) return null;

  const spouseRole: ParentRole = role === 'father' ? 'mother' : 'father';
  return resolveSpouseMember(members, marriage, spouseRole);
}

export function resolveParentsWithMarriage(
  members: FamilyMemberInput[],
  marriages: MarriageRecord[],
  fatherName: string,
  motherName: string,
  fatherMatch: ParentMatchResult,
  motherMatch: ParentMatchResult,
  selectedFather?: FamilyMemberInput | null,
  selectedMother?: FamilyMemberInput | null,
): ResolvedParents {
  let resolved = buildResolvedParents(
    fatherName,
    motherName,
    fatherMatch,
    motherMatch,
    selectedFather,
    selectedMother,
  );

  const cleanedFather = cleanNameInput(fatherName);
  const cleanedMother = cleanNameInput(motherName);

  if (isValidLinkedParent(resolved.father, 'father') && !resolved.mother && !cleanedMother) {
    const inferredMother = inferSpouseFromMarriage(
      members,
      marriages,
      resolved.father,
      cleanedFather,
      'father',
    );
    if (inferredMother) {
      resolved = { ...resolved, mother: inferredMother, motherNameText: null };
    }
  }

  if (isValidLinkedParent(resolved.mother, 'mother') && !resolved.father && !cleanedFather) {
    const inferredFather = inferSpouseFromMarriage(
      members,
      marriages,
      resolved.mother,
      cleanedMother,
      'mother',
    );
    if (isValidLinkedParent(inferredFather, 'father')) {
      resolved = { ...resolved, father: inferredFather, fatherNameText: null };
    } else {
      const marriage = findMarriageByPersonId(marriages, resolved.mother.id);
      if (marriage?.husbandName && !resolved.fatherNameText) {
        resolved = { ...resolved, fatherNameText: marriage.husbandName };
      }
    }
  }

  if (!isValidLinkedParent(resolved.father, 'father') && cleanedFather) {
    const marriage = findMarriageByHusbandName(marriages, cleanedFather);
    if (marriage) {
      const father = resolveLinkedParentFromMarriage(members, marriage, 'father');
      const mother = resolveLinkedParentFromMarriage(members, marriage, 'mother');

      if (mother || father || marriage.husbandName) {
        resolved = {
          father: father ?? null,
          mother: mother ?? null,
          fatherNameText: father ? null : marriage.husbandName || cleanedFather,
          motherNameText: mother ? null : marriage.wifeName || null,
        };
      }
    }
  }

  if (!resolved.mother && cleanedMother && !cleanedFather) {
    const marriage = findMarriageByWifeName(marriages, cleanedMother);
    if (marriage) {
      const mother = resolveLinkedParentFromMarriage(members, marriage, 'mother');
      const father = resolveLinkedParentFromMarriage(members, marriage, 'father');

      if (mother) {
        resolved = {
          father: father ?? null,
          mother,
          fatherNameText: father ? null : marriage.husbandName || null,
          motherNameText: null,
        };
      }
    }
  }

  if (!isValidLinkedParent(resolved.father, 'father') && cleanedFather && !resolved.fatherNameText) {
    resolved = { ...resolved, fatherNameText: cleanedFather };
  }

  if (!isValidLinkedParent(resolved.father, 'father')) {
    resolved = { ...resolved, father: null };
  }

  if (!isValidLinkedParent(resolved.mother, 'mother')) {
    resolved = { ...resolved, mother: null };
  }

  return resolved;
}

export function getInferredMotherName(
  members: FamilyMemberInput[],
  marriages: MarriageRecord[],
  fatherName: string,
  resolvedFather?: FamilyMemberInput | null,
): string | null {
  const cleanedFather = cleanNameInput(fatherName);
  if (!cleanedFather) return null;

  const father = isValidLinkedParent(resolvedFather, 'father')
    ? resolvedFather
    : memberFromName(members, cleanedFather, 'father');
  const inferredMother = inferSpouseFromMarriage(
    members,
    marriages,
    father,
    cleanedFather,
    'father',
  );

  if (inferredMother) return inferredMother.fullName;

  const marriage = findMarriageByHusbandName(marriages, cleanedFather);
  return marriage?.wifeName ?? null;
}

export function getInferredFatherName(
  members: FamilyMemberInput[],
  marriages: MarriageRecord[],
  motherName: string,
  resolvedMother?: FamilyMemberInput | null,
): string | null {
  const cleanedMother = cleanNameInput(motherName);
  if (!cleanedMother) return null;

  const mother = isValidLinkedParent(resolvedMother, 'mother')
    ? resolvedMother
    : memberFromName(members, cleanedMother, 'mother');
  const inferredFather = inferSpouseFromMarriage(
    members,
    marriages,
    mother,
    cleanedMother,
    'mother',
  );

  if (inferredFather) return inferredFather.fullName;

  const marriage = findMarriageByWifeName(marriages, cleanedMother);
  return marriage?.husbandName ?? null;
}
