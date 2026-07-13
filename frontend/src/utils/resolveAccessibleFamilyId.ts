import { getFamily, listMyFamilies } from '../services/personService';
import { ApiError } from '../lib/api';

const ENV_FAMILY_ID = Number(import.meta.env.VITE_FAMILY_ID ?? 0);

/** Parse an optional family id from route or query string. */
export function parseRequestedFamilyId(
  routeFamilyId?: string,
  queryFamilyId?: string | null,
): number | null {
  const raw = routeFamilyId?.trim() || queryFamilyId?.trim() || '';
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/** Resolve the family the current user can access (URL override, env, then first membership). */
export async function resolveAccessibleFamilyId(
  requestedFamilyId: number | null = null,
): Promise<number> {
  if (requestedFamilyId != null && requestedFamilyId > 0) {
    try {
      await getFamily(requestedFamilyId);
      return requestedFamilyId;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 403) {
        throw new ApiError('لا تملك صلاحية الوصول إلى هذه العائلة.', 403);
      }
      if (status === 404) {
        throw new ApiError('العائلة المطلوبة غير موجودة.', 404);
      }
      throw error;
    }
  }

  if (ENV_FAMILY_ID > 0) {
    try {
      await getFamily(ENV_FAMILY_ID);
      return ENV_FAMILY_ID;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status !== 403 && status !== 404) {
        throw error;
      }
    }
  }

  const response = await listMyFamilies();
  const family = response.data[0];

  if (!family) {
    throw new ApiError('لا توجد عائلة مرتبطة بحسابك. تواصل مع مدير العائلة.', 403);
  }

  return family.id;
}
