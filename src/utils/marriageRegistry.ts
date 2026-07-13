import { cleanNameInput, normalizeArabicName } from './normalizeArabicName';
import type { FamilyMemberInput } from './treeLayout/types';

const STORAGE_KEY_PREFIX = 'familytree-marriages:v1:';

export interface MarriageRecord {
  husbandId: number | null;
  wifeId: number | null;
  husbandName: string;
  wifeName: string;
}

function storageKey(familyId: number): string {
  return `${STORAGE_KEY_PREFIX}${familyId}`;
}

function normalizeMarriageName(name: string): string {
  return normalizeArabicName(cleanNameInput(name));
}

function recordsEqual(a: MarriageRecord, b: MarriageRecord): boolean {
  return (
    a.husbandId === b.husbandId
    && a.wifeId === b.wifeId
    && normalizeMarriageName(a.husbandName) === normalizeMarriageName(b.husbandName)
    && normalizeMarriageName(a.wifeName) === normalizeMarriageName(b.wifeName)
  );
}

export function getFamilyMarriages(familyId: number): MarriageRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(familyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarriageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function registerMarriage(familyId: number, record: MarriageRecord): void {
  if (typeof window === 'undefined') return;

  const normalized: MarriageRecord = {
    husbandId: record.husbandId,
    wifeId: record.wifeId,
    husbandName: cleanNameInput(record.husbandName),
    wifeName: cleanNameInput(record.wifeName),
  };

  if (!normalized.husbandName && !normalized.wifeName) return;

  const existing = getFamilyMarriages(familyId);
  const duplicate = existing.some((item) => recordsEqual(item, normalized));
  if (duplicate) return;

  const updated = [
    ...existing.filter((item) => !(
      (normalized.husbandId != null && item.husbandId === normalized.husbandId)
      || (normalized.wifeId != null && item.wifeId === normalized.wifeId)
    )),
    normalized,
  ];

  window.localStorage.setItem(storageKey(familyId), JSON.stringify(updated));
}

export function unregisterMarriageForPerson(familyId: number, personId: number): void {
  if (typeof window === 'undefined') return;

  const updated = getFamilyMarriages(familyId).filter((item) => (
    item.husbandId !== personId && item.wifeId !== personId
  ));

  window.localStorage.setItem(storageKey(familyId), JSON.stringify(updated));
}

export function findMarriageByHusbandName(
  marriages: MarriageRecord[],
  husbandName: string,
): MarriageRecord | null {
  const normalized = normalizeMarriageName(husbandName);
  if (!normalized) return null;

  return marriages.find((marriage) => (
    normalizeMarriageName(marriage.husbandName) === normalized
  )) ?? null;
}

export function findMarriageByWifeName(
  marriages: MarriageRecord[],
  wifeName: string,
): MarriageRecord | null {
  const normalized = normalizeMarriageName(wifeName);
  if (!normalized) return null;

  return marriages.find((marriage) => (
    normalizeMarriageName(marriage.wifeName) === normalized
  )) ?? null;
}

export function findMarriageByPersonId(
  marriages: MarriageRecord[],
  personId: number,
): MarriageRecord | null {
  return marriages.find((marriage) => (
    marriage.husbandId === personId || marriage.wifeId === personId
  )) ?? null;
}

function marriagesReferToSameCouple(left: MarriageRecord, right: MarriageRecord): boolean {
  const sameHusband = Boolean(
    (left.husbandId != null && left.husbandId === right.husbandId)
    || (
      left.husbandName
      && right.husbandName
      && normalizeMarriageName(left.husbandName) === normalizeMarriageName(right.husbandName)
    ),
  );
  const sameWife = Boolean(
    (left.wifeId != null && left.wifeId === right.wifeId)
    || (
      left.wifeName
      && right.wifeName
      && normalizeMarriageName(left.wifeName) === normalizeMarriageName(right.wifeName)
    ),
  );
  return sameHusband && sameWife;
}

/** Merge one-sided marriage rows into a single couple record. */
export function mergeMarriageRecords(records: MarriageRecord[]): MarriageRecord[] {
  const merged: MarriageRecord[] = [];

  records.forEach((record) => {
    const existingIndex = merged.findIndex((item) => marriagesReferToSameCouple(item, record));
    if (existingIndex === -1) {
      merged.push({
        husbandId: record.husbandId,
        wifeId: record.wifeId,
        husbandName: cleanNameInput(record.husbandName),
        wifeName: cleanNameInput(record.wifeName),
      });
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      husbandId: record.husbandId ?? existing.husbandId,
      wifeId: record.wifeId ?? existing.wifeId,
      husbandName: cleanNameInput(record.husbandName || existing.husbandName),
      wifeName: cleanNameInput(record.wifeName || existing.wifeName),
    };
  });

  return merged.filter((record) => record.husbandName || record.wifeName);
}

export function saveFamilyMarriages(familyId: number, records: MarriageRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(familyId), JSON.stringify(records));
}

/** Fix marriage rows where spouse ids were saved with the wrong gender. */
export function sanitizeFamilyMarriages(
  familyId: number,
  members: FamilyMemberInput[],
): void {
  if (typeof window === 'undefined') return;

  const byId = new Map(members.map((member) => [member.id, member]));
  const marriages = getFamilyMarriages(familyId);
  if (marriages.length === 0) return;

  const fixed = marriages.map((record) => {
    let { husbandId, wifeId, husbandName, wifeName } = record;
    const husband = husbandId != null ? byId.get(husbandId) : undefined;
    const wife = wifeId != null ? byId.get(wifeId) : undefined;

    if (husband?.gender === 'female') {
      husbandId = null;
      wifeId = wifeId ?? husband.id;
      wifeName = wifeName || husband.fullName;
      if (husbandName && husbandName.trim() === husband.fullName.trim()) {
        husbandName = '';
      }
    }

    if (wife?.gender === 'male') {
      wifeId = null;
      husbandId = husbandId ?? wife.id;
      husbandName = husbandName || wife.fullName;
      if (wifeName && wifeName.trim() === wife.fullName.trim()) {
        wifeName = '';
      }
    }

    return {
      husbandId,
      wifeId,
      husbandName: cleanNameInput(husbandName),
      wifeName: cleanNameInput(wifeName),
    };
  });

  saveFamilyMarriages(familyId, mergeMarriageRecords(fixed));
}

/** Drop marriage rows that reference people no longer in the family. */
export function pruneFamilyMarriagesToMemberIds(
  familyId: number,
  memberIds: ReadonlySet<number>,
): void {
  if (typeof window === 'undefined') return;

  const pruned = getFamilyMarriages(familyId).filter((record) => {
    const husbandOk = record.husbandId == null || memberIds.has(record.husbandId);
    const wifeOk = record.wifeId == null || memberIds.has(record.wifeId);
    return husbandOk && wifeOk;
  });

  saveFamilyMarriages(familyId, pruned);
}
