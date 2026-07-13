import axios from 'axios';

import { api } from '../lib/api';
import {
  invalidateFamilyTreeCache,
} from '../utils/familyTreeCache';
import type {  ApiResponse,
  CreatePersonPayload,
  HierarchyNode,
  PaginatedResponse,
  ParentCandidate,
  PersonDetail,
  PersonSummary,
  UpdatePersonPayload,
} from '../types/person';

export interface FamilyDetails {
  id: number;
  name: string;
  description: string | null;
  founder_person_id: number | null;
}

export interface FamilyPeopleBundleMeta {
  total: number;
  version: string;
  updated_at: string | null;
}

export interface FamilyPeopleBundle {
  data: PersonSummary[];
  meta: FamilyPeopleBundleMeta;
}

export async function listMyFamilies() {
  const response = await api.get<{ data: FamilyDetails[] }>('/families');
  return response.data;
}

export async function createFamily(payload: { name: string; description?: string | null }) {
  const response = await api.post<{ data: FamilyDetails }>('/families', payload);
  return response.data;
}

export async function deleteFamily(familyId: number) {
  const response = await api.delete<ApiResponse<null>>(`/families/${familyId}`);
  invalidateFamilyTreeCache(familyId);
  return response.data;
}

export async function getFamily(familyId: number) {
  const response = await api.get<{ data: FamilyDetails }>(`/families/${familyId}`);
  return response.data;
}

export async function listFamilyPeople(
  familyId: number,
  params?: { search?: string; page?: number; per_page?: number },
) {
  const response = await api.get<PaginatedResponse<PersonSummary>>(
    `/families/${familyId}/people`,
    { params },
  );
  return response.data;
}

/** Single JSON payload for the full family roster — used by the tree cache. */
export async function fetchFamilyPeopleBundle(familyId: number): Promise<FamilyPeopleBundle> {
  try {
    const response = await api.get<FamilyPeopleBundle>(
      `/families/${familyId}/people/export`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
      const people = await fetchAllFamilyPeople(familyId);
      return {
        data: people,
        meta: {
          total: people.length,
          version: String(people.length),
          updated_at: null,
        },
      };
    }

    throw error;
  }
}

/** Fetch every family member in parallel pages — legacy fallback when /export is unavailable. */
export async function fetchAllFamilyPeople(familyId: number): Promise<PersonSummary[]> {  const PER_PAGE = 250;
  const firstPage = await listFamilyPeople(familyId, { per_page: PER_PAGE, page: 1 });
  const all = [...firstPage.data];
  const lastPage = firstPage.meta?.last_page ?? 1;

  if (lastPage <= 1) {
    return all;
  }

  const pageResponses = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) => (
      listFamilyPeople(familyId, { per_page: PER_PAGE, page: index + 2 })
    )),
  );

  pageResponses.forEach((response) => {
    all.push(...response.data);
  });

  return all;
}

export async function getPerson(familyId: number, personId: number) {
  const response = await api.get<ApiResponse<PersonDetail>>(
    `/families/${familyId}/people/${personId}`,
  );
  return response.data;
}

export async function createPerson(familyId: number, payload: CreatePersonPayload) {
  const response = await api.post<ApiResponse<PersonDetail>>(
    `/families/${familyId}/people`,
    payload,
  );
  invalidateFamilyTreeCache(familyId);
  return response.data;
}

export async function deletePerson(familyId: number, personId: number) {
  const response = await api.delete<ApiResponse<null>>(
    `/families/${familyId}/people/${personId}`,
  );
  invalidateFamilyTreeCache(familyId);
  return response.data;
}

export async function updatePerson(
  familyId: number,
  personId: number,
  payload: UpdatePersonPayload,
) {
  const response = await api.put<ApiResponse<PersonDetail>>(
    `/families/${familyId}/people/${personId}`,
    payload,
  );
  invalidateFamilyTreeCache(familyId);
  return response.data;
}

export async function searchParentCandidates(
  familyId: number,
  params: {
    search?: string;
    gender?: 'male' | 'female' | 'other';
    exclude_person_id?: number;
    limit?: number;
  },
) {
  const response = await api.get<{ data: ParentCandidate[] }>(
    `/families/${familyId}/people/parent-candidates`,
    { params },
  );
  return response.data;
}

export async function getFamilyTree(familyId: number) {
  const response = await api.get<{ data: HierarchyNode[] }>(`/families/${familyId}/tree`);
  return response.data;
}

export async function getPersonDescendants(familyId: number, personId: number) {
  const response = await api.get<ApiResponse<HierarchyNode>>(
    `/families/${familyId}/people/${personId}/descendants`,
  );
  return response.data;
}
