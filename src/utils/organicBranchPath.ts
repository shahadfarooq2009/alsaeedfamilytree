import type { PositionedLink } from '../types/tree';
import { branchVisual } from '../features/family-tree/theme/treeAssets';

export interface BranchStrokeStyle {
  base: number;
  highlight: number;
  shadow: number;
}

/** Organic wood limb stroke widths by parent depth — no gold pipe stripe. */
export function getBranchStrokeStyle(link: PositionedLink): BranchStrokeStyle {
  const depth = link.source.depth;

  if (depth === 0) {
    return { base: 19, highlight: 7, shadow: 24 };
  }

  if (depth === 1) {
    return { base: 12, highlight: 5, shadow: 16 };
  }

  if (depth === 2) {
    return { base: 8, highlight: 3.5, shadow: 11 };
  }

  return { base: 4.5, highlight: 2, shadow: 7 };
}

export function getBranchTone(link: PositionedLink): {
  stroke: string;
  highlight: string;
  shadow: string;
} {
  const depth = link.source.depth;

  if (depth === 0) {
    return {
      stroke: branchVisual.stroke,
      highlight: branchVisual.highlight,
      shadow: branchVisual.shadow,
    };
  }

  if (depth === 1) {
    return {
      stroke: branchVisual.strokeLight,
      highlight: branchVisual.highlightSoft,
      shadow: 'rgba(42, 34, 26, 0.16)',
    };
  }

  if (depth === 2) {
    return {
      stroke: branchVisual.strokeOlive,
      highlight: '#a39482',
      shadow: 'rgba(47, 54, 40, 0.14)',
    };
  }

  return {
    stroke: '#7a8268',
    highlight: '#b0a494',
    shadow: 'rgba(47, 54, 40, 0.1)',
  };
}

export function formatLifeYears(
  birthDate: string | null,
  deathDate: string | null,
): string | null {
  const birthYear = birthDate?.slice(0, 4);
  const deathYear = deathDate?.slice(0, 4);

  if (birthYear && deathYear) {
    return `${birthYear} – ${deathYear}`;
  }

  if (birthYear) {
    return birthYear;
  }

  if (deathYear) {
    return `† ${deathYear}`;
  }

  return null;
}

export function isFounderNode(node: {
  data: { generation_number: number; is_family_head?: boolean };
}): boolean {
  return node.data.generation_number === 0 || Boolean(node.data.is_family_head);
}
