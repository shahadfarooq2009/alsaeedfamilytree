export function formatLifeDates(
  birthDate?: string | null,
  deathDate?: string | null,
): string | null {
  const birth = formatYear(birthDate);
  const death = formatYear(deathDate);

  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `م. ${birth}`;
  if (death) return `† ${death}`;
  return null;
}

function formatYear(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const yearMatch = trimmed.match(/\d{4}/);
  if (yearMatch) return yearMatch[0];

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return String(new Date(parsed).getFullYear());
  }

  return trimmed;
}
