/** Short label for the searched person (first name + father's first name). */
export function shortKinshipInputName(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return trimmed;
  return parts.slice(0, 2).join(' ');
}

/** Short reference name for the second person (first name only). */
export function shortKinshipReferenceName(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  return trimmed.split(/\s+/).filter(Boolean)[0] ?? trimmed;
}

export function formatKinshipMessage(
  subjectQuery: string,
  objectQuery: string,
  term: string,
): string {
  const subject = shortKinshipInputName(subjectQuery);
  const object = shortKinshipReferenceName(objectQuery);
  const normalizedTerm = simplifyKinshipTerm(term.trim());
  return `${subject} تصير ${normalizedTerm} ${object}`;
}

export function simplifyKinshipTerm(term: string): string {
  return term
    .replace(/ابنة أخ\/اخت/g, 'ابنة أخت')
    .replace(/ابن أخ\/اخت/g, 'ابن أخ')
    .replace(/حفيدة بنت خال/g, 'حفيدة بنت خال')
    .replace(/حفيد ابن خال/g, 'حفيد ابن خال')
    .replace(/قريبة من الدرجة \d+.*/g, 'قريبة')
    .replace(/قريب من الدرجة \d+.*/g, 'قريب')
    .replace(/قريبة \(\d+ خطوات قرابة\)/g, 'قريبة')
    .replace(/قريب \(\d+ خطوات قرابة\)/g, 'قريب')
    .replace(/\s+/g, ' ')
    .trim();
}
