export function getPersonInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`;
}
