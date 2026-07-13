/**
 * @deprecated Visible SVG pipe branches removed — use ImageBranchLayer instead.
 * Kept as a no-op stub so imports do not break during migration.
 */
import type { PositionedLink } from '../../types/tree';

interface OrganicBranchProps {
  links: PositionedLink[];
}

export function OrganicBranch({ links }: OrganicBranchProps) {
  void links;
  return null;
}
