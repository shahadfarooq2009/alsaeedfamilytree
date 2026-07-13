import axios from 'axios';

import type { HierarchyNode } from '../types/person';
import { mergePeopleIntoHierarchy } from '../utils/normalizeFamilyData';
import { pruneFamilyMarriagesToMemberIds, sanitizeFamilyMarriages } from '../utils/marriageRegistry';
import { repairCorruptedParentLinks } from '../utils/repairCorruptedParentLinks';
import {
  createCachedFamilyTreeBundle,
  getCachedFamilyTreeBundle,
  setCachedFamilyTreeBundle,
  type CachedFamilyTreeBundle,
} from '../utils/familyTreeCache';
import {
  fetchFamilyPeopleBundle,
  getFamily,
} from './personService';

export interface FetchFamilyTreeBundleOptions {
  bypassCache?: boolean;
}

function finalizeFamilyBundle(bundle: CachedFamilyTreeBundle): CachedFamilyTreeBundle {
  const memberIds = new Set(bundle.members.map((member) => member.id));

  pruneFamilyMarriagesToMemberIds(bundle.familyId, memberIds);
  sanitizeFamilyMarriages(bundle.familyId, bundle.members);

  void repairCorruptedParentLinks(bundle.familyId, bundle.people, bundle.members).catch(() => undefined);

  return bundle;
}

async function tryFetchServerTreeBundle(familyId: number): Promise<CachedFamilyTreeBundle | null> {
  try {
    const { api } = await import('../lib/api');
    const response = await api.get<{
      data: {
        family: CachedFamilyTreeBundle['family'];
        people: CachedFamilyTreeBundle['people'];
        tree?: HierarchyNode[];
        members?: CachedFamilyTreeBundle['members'];
        meta?: {
          total?: number;
          version?: string;
          updated_at?: string | null;
        };
      };
    }>(`/families/${familyId}/tree-bundle`);

    const payload = response.data.data;
    const members = payload.members?.length
      ? payload.members
      : mergePeopleIntoHierarchy(payload.tree ?? [], payload.people);

    return finalizeFamilyBundle(createCachedFamilyTreeBundle({
      familyId,
      family: payload.family,
      people: payload.people,
      members,
      version: payload.meta?.version,
      updatedAt: payload.meta?.updated_at ?? null,
    }));
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
      return null;
    }
    throw error;
  }
}

async function fetchFamilyTreeBundleFromApis(familyId: number): Promise<CachedFamilyTreeBundle> {
  const [familyResponse, peopleBundle] = await Promise.all([
    getFamily(familyId),
    fetchFamilyPeopleBundle(familyId),
  ]);

  const members = mergePeopleIntoHierarchy([], peopleBundle.data);

  return finalizeFamilyBundle(createCachedFamilyTreeBundle({
    familyId,
    family: familyResponse.data,
    people: peopleBundle.data,
    members,
    version: peopleBundle.meta.version,
    updatedAt: peopleBundle.meta.updated_at,
  }));
}

export async function fetchFamilyTreeBundle(
  familyId: number,
  options: FetchFamilyTreeBundleOptions = {},
): Promise<CachedFamilyTreeBundle> {
  if (!options.bypassCache) {
    const cached = getCachedFamilyTreeBundle(familyId);
    if (cached) return finalizeFamilyBundle(cached);
  }

  const serverBundle = await tryFetchServerTreeBundle(familyId);
  const bundle = finalizeFamilyBundle(serverBundle ?? await fetchFamilyTreeBundleFromApis(familyId));

  setCachedFamilyTreeBundle(bundle);
  return bundle;
}
