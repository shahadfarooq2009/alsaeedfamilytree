import { updatePerson } from '../services/personService';
import type { PersonSummary } from '../types/person';
import { formatMemberNameWithFather, getMemberFirstName } from './normalizeFamilyData';
import { normalizeArabicName } from './normalizeArabicName';
import { resolveMemberParentNames } from './memberDisplayInfo';
import type { FamilyMemberInput } from './treeLayout/types';

function needsNameRepair(
  person: PersonSummary,
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  familyId: number,
): boolean {
  if (person.is_family_head) return false;

  const parents = resolveMemberParentNames(member, members, person, familyId);
  if (!parents.fatherName) return false;

  const firstName = getMemberFirstName(person.full_name);
  const expected = formatMemberNameWithFather(firstName, parents.fatherName);
  const current = person.full_name.trim();
  if (!current || normalizeArabicName(current) === normalizeArabicName(expected)) {
    return false;
  }

  if (parents.motherName && current.includes(parents.motherName)) {
    return true;
  }

  const fatherText = person.father_name_text?.trim();
  if (fatherText && !current.includes(fatherText)) {
    return true;
  }

  return false;
}

export async function repairCorruptedParentLinks(
  familyId: number,
  people: PersonSummary[],
  members: FamilyMemberInput[],
): Promise<number> {
  const repairs = people.filter((person) => {
    const member = members.find((item) => item.id === person.id);
    if (!member) return false;
    return needsNameRepair(person, member, members, familyId);
  });

  let updated = 0;

  for (const person of repairs) {
    const member = members.find((item) => item.id === person.id);
    if (!member) continue;

    const parents = resolveMemberParentNames(member, members, person, familyId);
    const firstName = getMemberFirstName(person.full_name);
    const fatherForName = person.father_name_text?.trim() || parents.fatherName;
    if (!fatherForName) continue;

    const fullName = formatMemberNameWithFather(firstName, fatherForName);

    try {
      await updatePerson(familyId, person.id, {
        first_name: firstName,
        full_name: fullName,
        ...(person.father_id == null ? { father_name_text: fatherForName } : {}),
      });
      updated += 1;
    } catch {
      // Best-effort repair — display fixes still apply even if persistence fails.
    }
  }

  return updated;
}
