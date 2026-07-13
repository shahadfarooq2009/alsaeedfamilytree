import { useCallback, useEffect, useState } from 'react';

import { createFamily, deleteFamily, listMyFamilies, type FamilyDetails } from '../services/personService';
import { toApiError } from '../lib/api';

const REAL_FAMILY_DEFAULT_NAME = 'عائلة الفاروق - البيانات الحقيقية';

interface UseMyFamiliesResult {
  families: FamilyDetails[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  deletingFamilyId: number | null;
  refresh: () => Promise<void>;
  createNewFamily: (name: string, description?: string | null) => Promise<FamilyDetails>;
  removeFamily: (familyId: number) => Promise<void>;
}

export function useMyFamilies(): UseMyFamiliesResult {
  const [families, setFamilies] = useState<FamilyDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingFamilyId, setDeletingFamilyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await listMyFamilies();
      setFamilies(response.data);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createNewFamily = useCallback(async (name: string, description?: string | null) => {
    setCreating(true);
    setError(null);
    try {
      const response = await createFamily({ name, description });
      setFamilies((current) => [...current, response.data]);
      return response.data;
    } catch (err) {
      const message = toApiError(err).message;
      setError(message);
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  const removeFamily = useCallback(async (familyId: number) => {
    setDeletingFamilyId(familyId);
    setError(null);
    try {
      await deleteFamily(familyId);
      setFamilies((current) => current.filter((family) => family.id !== familyId));
    } catch (err) {
      const message = toApiError(err).message;
      setError(message);
      throw err;
    } finally {
      setDeletingFamilyId(null);
    }
  }, []);

  return {
    families,
    loading,
    error,
    creating,
    deletingFamilyId,
    refresh,
    createNewFamily,
    removeFamily,
  };
}

export { REAL_FAMILY_DEFAULT_NAME };
