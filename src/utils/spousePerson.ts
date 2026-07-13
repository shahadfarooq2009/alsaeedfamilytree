import { updatePerson } from '../services/personService';
import type { Gender, PersonSummary } from '../types/person';
import { matchParentByFullName } from './addMember/resolveAddMemberPlacement';
import {
  findMarriageByPersonId,
  getFamilyMarriages,
  mergeMarriageRecords,
  registerMarriage,
  sanitizeFamilyMarriages,
  saveFamilyMarriages,
  unregisterMarriageForPerson,
} from './marriageRegistry';
import { syncChildrenFatherNames } from './syncChildrenFatherNames';
import { cleanNameInput } from './normalizeArabicName';
import type { FamilyMemberInput } from './treeLayout/types';

export interface MemberSpouseDisplay {
  label: 'الزوج' | 'الزوجة';
  name: string;
}

type PersonWithSpouseName = PersonSummary & { spouse_name?: string | null };

function resolveMarriageNames(
  personGender: Gender,
  personFullName: string,
  husbandName: string,
  wifeName: string,
): { husbandName: string; wifeName: string; spouseName: string } {
  const cleanedHusband = cleanNameInput(husbandName);
  const cleanedWife = cleanNameInput(wifeName);
  const personName = cleanNameInput(personFullName);

  if (personGender === 'female') {
    const resolvedHusband = cleanedHusband;
    const resolvedWife = cleanedWife || personName;
    return {
      husbandName: resolvedHusband,
      wifeName: resolvedWife,
      spouseName: resolvedHusband,
    };
  }

  if (personGender === 'male') {
    const resolvedHusband = cleanedHusband || personName;
    const resolvedWife = cleanedWife;
    return {
      husbandName: resolvedHusband,
      wifeName: resolvedWife,
      spouseName: resolvedWife,
    };
  }

  return {
    husbandName: cleanedHusband,
    wifeName: cleanedWife,
    spouseName: cleanedHusband || cleanedWife,
  };
}

export function isPersonMarried(
  person?: PersonWithSpouseName | null,
  familyId?: number,
  personId?: number,
): boolean {
  if (person?.spouse_name?.trim()) return true;

  if (familyId != null && personId != null) {
    return findMarriageByPersonId(getFamilyMarriages(familyId), personId) != null;
  }

  return false;
}

export function getMarriageFieldValues(
  personFullName: string,
  personGender: Gender,
  person?: PersonWithSpouseName | null,
  familyId?: number,
  personId?: number,
): { husbandName: string; wifeName: string } {
  const spouseName = person?.spouse_name?.trim() ?? '';
  const personName = personFullName.trim();
  const marriage = familyId != null && personId != null
    ? findMarriageByPersonId(getFamilyMarriages(familyId), personId)
    : null;

  if (personGender === 'female') {
    return {
      husbandName: spouseName || marriage?.husbandName || '',
      wifeName: marriage?.wifeName || personName,
    };
  }

  if (personGender === 'male') {
    return {
      husbandName: marriage?.husbandName || personName,
      wifeName: spouseName || marriage?.wifeName || '',
    };
  }

  return {
    husbandName: marriage?.husbandName || '',
    wifeName: marriage?.wifeName || '',
  };
}

export function getMemberSpouseDisplay(
  member: FamilyMemberInput,
  options: {
    person?: PersonSummary | null;
    members?: FamilyMemberInput[];
    familyId?: number;
  } = {},
): MemberSpouseDisplay | null {
  const gender = options.person?.gender ?? member.gender ?? null;
  const person = options.person as PersonWithSpouseName | null | undefined;
  const spouseName = person?.spouse_name?.trim();

  if (spouseName) {
    return {
      label: gender === 'female' ? 'الزوج' : 'الزوجة',
      name: spouseName,
    };
  }

  if (options.familyId != null) {
    const marriage = findMarriageByPersonId(getFamilyMarriages(options.familyId), member.id);
    if (!marriage) return null;

    if (marriage.husbandId === member.id) {
      const name = marriage.wifeName.trim();
      if (!name) return null;
      return { label: 'الزوجة', name };
    }

    if (marriage.wifeId === member.id) {
      const name = marriage.husbandName.trim();
      if (!name) return null;
      return { label: 'الزوج', name };
    }
  }

  return null;
}

function resolveMarriageMemberIds(
  members: FamilyMemberInput[],
  husbandName: string,
  wifeName: string,
  personId: number,
  personGender: Gender,
): { husbandId: number | null; wifeId: number | null } {
  let husbandId = personGender === 'male' ? personId : null;
  let wifeId = personGender === 'female' ? personId : null;

  if (husbandId == null && husbandName) {
    const husbandMatch = matchParentByFullName(members, husbandName, 'father');
    if (husbandMatch.status === 'single') {
      husbandId = husbandMatch.members[0].id;
    }
  }

  if (wifeId == null && wifeName) {
    const wifeMatch = matchParentByFullName(members, wifeName, 'mother');
    if (wifeMatch.status === 'single') {
      wifeId = wifeMatch.members[0].id;
    }
  }

  return { husbandId, wifeId };
}

export function consolidateFamilyMarriages(
  familyId: number,
  members: FamilyMemberInput[] = [],
): void {
  const marriages = getFamilyMarriages(familyId);
  if (marriages.length === 0) return;

  const enriched = marriages.map((marriage) => {
    const husbandMatch = marriage.husbandId == null && marriage.husbandName
      ? matchParentByFullName(members, marriage.husbandName, 'father')
      : null;
    const wifeMatch = marriage.wifeId == null && marriage.wifeName
      ? matchParentByFullName(members, marriage.wifeName, 'mother')
      : null;

    return {
      ...marriage,
      husbandId: marriage.husbandId
        ?? (husbandMatch?.status === 'single' ? husbandMatch.members[0].id : null),
      wifeId: marriage.wifeId
        ?? (wifeMatch?.status === 'single' ? wifeMatch.members[0].id : null),
    };
  });

  saveFamilyMarriages(familyId, mergeMarriageRecords(enriched));
  sanitizeFamilyMarriages(familyId, members);
}

export async function saveMarriageData(
  familyId: number,
  personId: number,
  personGender: Gender,
  personFullName: string,
  husbandName: string,
  wifeName: string,
  members: FamilyMemberInput[] = [],
): Promise<void> {
  const resolved = resolveMarriageNames(personGender, personFullName, husbandName, wifeName);

  if (!resolved.spouseName && !resolved.husbandName && !resolved.wifeName) {
    return;
  }

  const previousMarriage = findMarriageByPersonId(getFamilyMarriages(familyId), personId);

  await updatePerson(familyId, personId, {
    spouse_name: resolved.spouseName || null,
  });

  const { husbandId, wifeId } = resolveMarriageMemberIds(
    members,
    resolved.husbandName,
    resolved.wifeName,
    personId,
    personGender,
  );

  if (personGender === 'male' && wifeId != null && wifeId !== personId) {
    await updatePerson(familyId, wifeId, {
      spouse_name: resolved.husbandName || personFullName,
    });
  } else if (personGender === 'female' && husbandId != null && husbandId !== personId) {
    await updatePerson(familyId, husbandId, {
      spouse_name: resolved.wifeName || personFullName,
    });
  }

  registerMarriage(familyId, {
    husbandId,
    wifeId,
    husbandName: resolved.husbandName,
    wifeName: resolved.wifeName,
  });

  consolidateFamilyMarriages(familyId, members);

  const nextHusbandName = resolved.husbandName.trim();
  if (personGender === 'female' && nextHusbandName) {
    await syncChildrenFatherNames({
      familyId,
      members,
      motherPersonId: personId,
      fatherPersonId: husbandId,
      nextFatherName: nextHusbandName,
    });
  } else if (
    personGender === 'male'
    && nextHusbandName
    && previousMarriage?.husbandName
    && previousMarriage.husbandName.trim() !== nextHusbandName
  ) {
    await syncChildrenFatherNames({
      familyId,
      members,
      fatherPersonId: personId,
      nextFatherName: personFullName.trim() || nextHusbandName,
    });
  }
}

export async function clearMarriageData(
  familyId: number,
  personId: number,
): Promise<void> {
  unregisterMarriageForPerson(familyId, personId);
  await updatePerson(familyId, personId, { spouse_name: null });
}

/** @deprecated Use saveMarriageData */
export async function saveMarriageSpouse(
  familyId: number,
  personId: number,
  personGender: Gender,
  husbandName: string,
  wifeName: string,
  _existingSpouse?: PersonSummary | null,
  personFullName?: string,
): Promise<void> {
  return saveMarriageData(
    familyId,
    personId,
    personGender,
    personFullName ?? husbandName ?? wifeName,
    husbandName,
    wifeName,
  );
}

export function syncMarriagesFromPeople(
  familyId: number,
  people: PersonSummary[],
  members: FamilyMemberInput[] = [],
): void {
  people.forEach((person) => {
    const spouseName = person.spouse_name?.trim();
    if (!spouseName) return;

    if (person.gender === 'female') {
      const husbandMatch = matchParentByFullName(members, spouseName, 'father');
      registerMarriage(familyId, {
        husbandId: husbandMatch.status === 'single' ? husbandMatch.members[0].id : null,
        wifeId: person.id,
        husbandName: spouseName,
        wifeName: person.full_name,
      });
      return;
    }

    if (person.gender === 'male') {
      const wifeMatch = matchParentByFullName(members, spouseName, 'mother');
      registerMarriage(familyId, {
        husbandId: person.id,
        wifeId: wifeMatch.status === 'single' ? wifeMatch.members[0].id : null,
        husbandName: person.full_name,
        wifeName: spouseName,
      });
    }
  });

  consolidateFamilyMarriages(familyId, members);
}

export function getStoredHusbandNames(
  marriages: ReturnType<typeof getFamilyMarriages>,
  members: FamilyMemberInput[],
): string[] {
  const memberFatherNames = new Set(
    members
      .filter((member) => member.gender !== 'female')
      .map((member) => cleanNameInput(member.fullName))
      .filter(Boolean),
  );

  return marriages
    .map((marriage) => marriage.husbandName.trim())
    .filter((name) => name.length > 0)
    .filter((name) => !memberFatherNames.has(cleanNameInput(name)))
    .filter((name, index, list) => list.indexOf(name) === index);
}
