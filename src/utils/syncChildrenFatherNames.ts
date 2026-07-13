import { updatePerson } from '../services/personService';
import { formatMemberNameWithFather, getMemberFirstName } from './normalizeFamilyData';
import { cleanNameInput, normalizeArabicName } from './normalizeArabicName';
import type { FamilyMemberInput } from './treeLayout/types';

export interface SyncChildrenFatherNamesParams {
  familyId: number;
  members: FamilyMemberInput[];
  /** Mother person id — updates all children linked to this mother. */
  motherPersonId?: number | null;
  /** Linked father person id — updates children with this father_id. */
  fatherPersonId?: number | null;
  /** New father full name used in children's patronymic. */
  nextFatherName: string;
}

function isLinkedChild(
  child: FamilyMemberInput,
  motherPersonId: number | null,
  fatherPersonId: number | null,
): boolean {
  if (motherPersonId != null && child.motherId === motherPersonId) {
    return true;
  }
  if (fatherPersonId != null && child.fatherId === fatherPersonId) {
    return true;
  }
  return false;
}

/** Update children's full_name (and father_name_text) after a father/husband rename. */
export async function syncChildrenFatherNames(
  params: SyncChildrenFatherNamesParams,
): Promise<number> {
  const nextFatherName = cleanNameInput(params.nextFatherName);
  if (!nextFatherName) return 0;

  const motherPersonId = params.motherPersonId ?? null;
  const fatherPersonId = params.fatherPersonId ?? null;
  if (motherPersonId == null && fatherPersonId == null) return 0;

  const children = params.members.filter((child) => (
    isLinkedChild(child, motherPersonId, fatherPersonId)
  ));

  let updated = 0;

  for (const child of children) {
    const firstName = getMemberFirstName(child.fullName);
    const fullName = formatMemberNameWithFather(firstName, nextFatherName);

    const nameUnchanged = normalizeArabicName(fullName) === normalizeArabicName(child.fullName);
    const textUnchanged = child.fatherId != null
      || normalizeArabicName(child.fatherNameText ?? '') === normalizeArabicName(nextFatherName);

    if (nameUnchanged && textUnchanged) {
      continue;
    }

    try {
      await updatePerson(params.familyId, child.id, {
        first_name: firstName,
        full_name: fullName,
        ...(child.fatherId == null ? { father_name_text: nextFatherName } : {}),
      });
      updated += 1;
    } catch {
      // Best-effort — continue updating remaining children.
    }
  }

  return updated;
}
