import { api } from '../lib/api';
import type {
  ApiResponse,
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

export async function listMyFamilies() {
  const response = await api.get<{ data: FamilyDetails[] }>('/families');
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
