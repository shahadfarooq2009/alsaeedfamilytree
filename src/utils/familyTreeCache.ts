import type { FamilyDetails } from '../services/personService';
import type { PersonSummary } from '../types/person';
import type { FamilyMemberInput } from './treeLayout/types';

const CACHE_STORAGE_PREFIX = 'family-tree-bundle:v1:';
const CACHE_SCHEMA_VERSION = 2;

export interface CachedFamilyTreeBundle {
  schemaVersion: number;
  familyId: number;
  family: FamilyDetails;
  people: PersonSummary[];
  members: FamilyMemberInput[];
  meta: {
    total: number;
    version: string;
    updatedAt: string | null;
    cachedAt: number;
  };
}

const memoryCache = new Map<number, CachedFamilyTreeBundle>();

function storageKey(familyId: number): string {
  return `${CACHE_STORAGE_PREFIX}${familyId}`;
}

function readFromStorage(familyId: number): CachedFamilyTreeBundle | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(familyId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedFamilyTreeBundle;
    if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION) return null;
    if (parsed.familyId !== familyId) return null;
    if (!Array.isArray(parsed.members) || parsed.members.length === 0) return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(bundle: CachedFamilyTreeBundle): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(bundle.familyId), JSON.stringify(bundle));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[familyTreeCache] failed to persist bundle', error);
    }
  }
}

function removeFromStorage(familyId: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(familyId));
}

export function getCachedFamilyTreeBundle(familyId: number): CachedFamilyTreeBundle | null {
  const cached = memoryCache.get(familyId);
  if (cached) return cached;

  const stored = readFromStorage(familyId);
  if (stored) {
    memoryCache.set(familyId, stored);
    return stored;
  }

  return null;
}

export function setCachedFamilyTreeBundle(bundle: CachedFamilyTreeBundle): void {
  memoryCache.set(bundle.familyId, bundle);
  writeToStorage(bundle);
}

export function invalidateFamilyTreeCache(familyId: number): void {
  memoryCache.delete(familyId);
  removeFromStorage(familyId);
}

/** @deprecated Use invalidateFamilyTreeCache */
export function invalidateFamilyPeopleCache(familyId: number): void {
  invalidateFamilyTreeCache(familyId);
}

export function createCachedFamilyTreeBundle(input: {
  familyId: number;
  family: FamilyDetails;
  people: PersonSummary[];
  members: FamilyMemberInput[];
  version?: string;
  updatedAt?: string | null;
}): CachedFamilyTreeBundle {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    familyId: input.familyId,
    family: input.family,
    people: input.people,
    members: input.members,
    meta: {
      total: input.members.length,
      version: input.version ?? String(input.members.length),
      updatedAt: input.updatedAt ?? null,
      cachedAt: Date.now(),
    },
  };
}
