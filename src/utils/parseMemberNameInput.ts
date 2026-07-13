import { getMemberFirstName } from './normalizeFamilyData';

export function parseMemberNameInput(value: string) {
  const trimmed = value.trim();
  return {
    first_name: getMemberFirstName(trimmed),
    full_name: trimmed,
  };
}

export function normalizeDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'غير مسجل') return null;
  return trimmed.slice(0, 10);
}

export function formatDateForInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}
