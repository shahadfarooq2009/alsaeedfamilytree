import type { FamilyMemberInput } from './treeLayout/types';
import { getMemberFirstName } from './normalizeFamilyData';
import { normalizeArabicName } from './normalizeArabicName';

function matchScore(fullName: string, query: string): number | null {
  const normalizedName = normalizeArabicName(fullName);
  const normalizedQuery = normalizeArabicName(query);
  if (!normalizedQuery) return null;

  const firstName = normalizeArabicName(getMemberFirstName(fullName));

  if (normalizedName === normalizedQuery) return 0;
  if (firstName === normalizedQuery) return 1;
  if (normalizedName.startsWith(`${normalizedQuery} `)) return 2;
  if (normalizedName.startsWith(normalizedQuery)) return 3;
  if (firstName.startsWith(normalizedQuery)) return 4;
  if (normalizedName.includes(` ${normalizedQuery}`)) return 5;
  if (normalizedName.includes(normalizedQuery)) return 6;

  return null;
}

/** Rank members: exact first name first, then names starting with query, then partial matches. */
export function filterMembersByNameQuery(
  members: FamilyMemberInput[],
  query: string,
  limit = 12,
): FamilyMemberInput[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return members
    .map((member) => ({
      member,
      score: matchScore(member.fullName, trimmed),
    }))
    .filter((entry): entry is { member: FamilyMemberInput; score: number } => entry.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.member.fullName.localeCompare(b.member.fullName, 'ar');
    })
    .slice(0, limit)
    .map((entry) => entry.member);
}

export function filterNamesByQuery(
  names: string[],
  query: string,
  limit = 12,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return names
    .map((name) => ({
      name,
      score: matchScore(name, trimmed),
    }))
    .filter((entry): entry is { name: string; score: number } => entry.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.name.localeCompare(b.name, 'ar');
    })
    .slice(0, limit)
    .map((entry) => entry.name);
}
