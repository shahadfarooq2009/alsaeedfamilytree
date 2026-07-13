/** Returns a subtitle for the family header based on its name. */
export function getFamilyDataLabel(familyName: string | null | undefined): string | null {
  const name = familyName?.trim() ?? '';
  if (!name) return null;

  if (/تجريب/i.test(name)) {
    return 'بيانات تجريبية';
  }

  if (/حقيق/i.test(name)) {
    return 'بيانات حقيقية';
  }

  return null;
}

export function isDemoFamilyName(familyName: string | null | undefined): boolean {
  return /تجريب/i.test(familyName?.trim() ?? '');
}
