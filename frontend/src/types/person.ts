export type Gender = 'male' | 'female' | 'other';

export type PrivacyLevel = 'public' | 'family' | 'private';

export interface PersonSummary {
  id: number;
  family_id: number;
  full_name: string;
  gender: Gender | null;
  photo_url: string | null;
  birth_date: string | null;
  death_date: string | null;
  generation_number: number;
  is_family_head: boolean;
  is_living: boolean;
  father?: { id: number; full_name: string };
  mother?: { id: number; full_name: string };
}

export interface PersonDetail extends PersonSummary {
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  father_id: number | null;
  mother_id: number | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  biography: string | null;
  occupation: string | null;
  education: string | null;
  location: string | null;
  privacy_level: PrivacyLevel;
  children?: PersonSummary[];
  spouses?: PersonSummary[];
  created_at?: string;
  updated_at?: string;
}

export interface ParentCandidate {
  id: number;
  full_name: string;
  gender: Gender | null;
  photo_url: string | null;
  birth_date: string | null;
  generation_number: number;
  father_name?: string | null;
}

export interface HierarchyNode {
  id: number;
  full_name: string;
  generation_number: number;
  gender: Gender | null;
  photo_url: string | null;
  father_id?: number | null;
  mother_id?: number | null;
  birth_date: string | null;
  death_date: string | null;
  phone?: string | null;
  occupation?: string | null;
  education?: string | null;
  location?: string | null;
  biography?: string | null;
  is_family_head?: boolean;
  is_living?: boolean;
  children: HierarchyNode[];
}

export interface CreatePersonPayload {
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string;
  gender?: Gender | null;
  father_id?: number | null;
  mother_id?: number | null;
  birth_date?: string | null;
  death_date?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  biography?: string | null;
  occupation?: string | null;
  education?: string | null;
  location?: string | null;
  is_family_head?: boolean;
  is_living?: boolean;
  privacy_level?: PrivacyLevel;
  photo_url?: string | null;
}

export interface UpdatePersonPayload extends Partial<CreatePersonPayload> {}

export interface PaginatedResponse<T> {
  data: T[];
  links?: Record<string, string | null>;
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiResponse<T> {
  data: T;
}

export interface ValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}
