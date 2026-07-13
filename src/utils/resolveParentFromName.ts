import type { ParentCandidate } from '../types/person';
import { searchParentCandidates } from '../services/personService';

export interface ParentResolution {
  parentId: number | null;
  notFound: boolean;
}

/** Normalize Arabic names for comparison (diacritics, alef/ya variants, spacing). */
export function normalizeArabicName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function wordMatches(candidateWord: string, queryWord: string): boolean {
  if (candidateWord === queryWord) return true;
  if (candidateWord.startsWith(queryWord) || queryWord.startsWith(candidateWord)) return true;

  const maxLen = Math.max(candidateWord.length, queryWord.length);
  if (maxLen === 0) return true;

  const distance = levenshtein(candidateWord, queryWord);
  return 1 - distance / maxLen >= 0.82;
}

/** Score how closely a stored full name matches what the user typed (0–100). */
export function nameSimilarityScore(candidateName: string, query: string): number {
  const candidate = normalizeArabicName(candidateName);
  const normalizedQuery = normalizeArabicName(query);

  if (!normalizedQuery) return 0;
  if (candidate === normalizedQuery) return 100;
  if (candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate)) return 95;

  const queryWords = normalizedQuery.split(' ').filter(Boolean);
  const candidateWords = candidate.split(' ').filter(Boolean);

  if (queryWords.length === 0) return 0;

  let matchedWords = 0;
  for (const queryWord of queryWords) {
    if (candidateWords.some((candidateWord) => wordMatches(candidateWord, queryWord))) {
      matchedWords += 1;
    }
  }

  const wordRatio = matchedWords / queryWords.length;
  if (wordRatio === 1) return 90;
  if (wordRatio >= 0.75 && queryWords.length >= 2) return 82;
  if (queryWords.length === 1 && matchedWords === 1) return 78;

  return Math.round(wordRatio * 70);
}

function minimumAcceptableScore(query: string): number {
  const wordCount = normalizeArabicName(query).split(' ').filter(Boolean).length;
  return wordCount >= 2 ? 82 : 75;
}

function pickBestParent(
  candidates: ParentCandidate[],
  query: string,
  preferredGender?: 'male' | 'female',
): ParentCandidate {
  const scored = candidates
    .map((candidate) => {
      let score = nameSimilarityScore(candidate.full_name, query);
      if (preferredGender && candidate.gender === preferredGender) score += 3;
      return { candidate, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.candidate.generation_number - a.candidate.generation_number;
    });

  return scored[0].candidate;
}

async function fetchCandidates(
  familyId: number,
  search: string,
  gender?: 'male' | 'female',
): Promise<ParentCandidate[]> {
  const response = await searchParentCandidates(familyId, {
    search,
    ...(gender ? { gender } : {}),
    limit: 50,
  });
  return response.data;
}

async function collectParentCandidates(
  familyId: number,
  query: string,
  gender: 'male' | 'female',
): Promise<ParentCandidate[]> {
  const trimmed = query.trim();
  const firstWord = trimmed.split(/\s+/).filter(Boolean)[0] ?? '';
  const seen = new Map<number, ParentCandidate>();

  const add = (list: ParentCandidate[]) => {
    for (const candidate of list) {
      seen.set(candidate.id, candidate);
    }
  };

  add(await fetchCandidates(familyId, trimmed, gender));

  if (firstWord && firstWord !== trimmed) {
    add(await fetchCandidates(familyId, firstWord, gender));
  }

  if (seen.size === 0) {
    add(await fetchCandidates(familyId, trimmed));
    if (firstWord && firstWord !== trimmed) {
      add(await fetchCandidates(familyId, firstWord));
    }
  }

  return [...seen.values()];
}

async function resolveParentFromName(
  familyId: number,
  name: string,
  gender: 'male' | 'female',
): Promise<ParentResolution> {
  const query = name.trim();
  if (!query) {
    return { parentId: null, notFound: false };
  }

  const candidates = await collectParentCandidates(familyId, query, gender);
  const minScore = minimumAcceptableScore(query);

  const matches = candidates.filter(
    (candidate) => nameSimilarityScore(candidate.full_name, query) >= minScore,
  );

  if (matches.length >= 1) {
    return { parentId: pickBestParent(matches, query, gender).id, notFound: false };
  }

  return { parentId: null, notFound: true };
}

/** Resolve father_id from typed father name via API search. */
export async function resolveFatherFromName(
  familyId: number,
  fatherName: string,
): Promise<{ fatherId: number | null; notFound: boolean }> {
  const result = await resolveParentFromName(familyId, fatherName, 'male');
  return { fatherId: result.parentId, notFound: result.notFound };
}

/** Resolve mother_id from typed mother name via API search. */
export async function resolveMotherFromName(
  familyId: number,
  motherName: string,
): Promise<{ motherId: number | null; notFound: boolean }> {
  const result = await resolveParentFromName(familyId, motherName, 'female');
  return { motherId: result.parentId, notFound: result.notFound };
}
