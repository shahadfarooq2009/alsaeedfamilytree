const TASHKEEL_RE = /[\u064B-\u065F\u0670]/g;

/** Trim, collapse spaces, strip diacritics, unify common Arabic letter variants. */
export function normalizeArabicName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(TASHKEEL_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

/** User-facing cleanup before save/search — keeps readable casing. */
export function cleanNameInput(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
