import type { PrototypeBranchLabel, PrototypeMember } from '../components/reference-tree/prototypeMembers';
import {
  CARD_REGULAR,
  GENERATION_Y,
  getCardDimensions,
  isFounderMember,
  LAYOUT_GAPS,
  OVERLAY_BOUNDS,
} from './cardLayoutMetrics';

export interface PositionedMember extends PrototypeMember {
  x: number;
  y: number;
}

const REF_OVERLAY_W = 1280;

function clampX(value: number): number {
  return Math.min(OVERLAY_BOUNDS.maxX, Math.max(OVERLAY_BOUNDS.minX, value));
}

function pxGapToPercent(gapPx: number): number {
  return (gapPx / REF_OVERLAY_W) * 100;
}

function childStepPercent(count: number): number {
  if (count <= 1) return 0;
  const spanPx = count * CARD_REGULAR.width + (count - 1) * LAYOUT_GAPS.siblingHorizontal;
  return (spanPx / REF_OVERLAY_W) * 100 / (count - 1);
}

function generationY(generation: number): number {
  return GENERATION_Y[generation] ?? GENERATION_Y[4];
}

/** Lay out siblings in a tight row at a fixed generation tier. */
function layoutSiblingCluster(
  children: PrototypeMember[],
  centerX: number,
  y: number,
  positions: Map<number, { x: number; y: number }>,
): void {
  if (children.length === 0) return;

  children.sort((a, b) => a.id - b.id);
  const step = childStepPercent(children.length);

  if (children.length <= 4) {
    children.forEach((child, index) => {
      const offset = children.length === 1 ? 0 : (index - (children.length - 1) / 2) * step;
      positions.set(child.id, {
        x: clampX(centerX + offset),
        y,
      });
    });
    return;
  }

  const firstRowCount = Math.ceil(children.length / 2);
  const rowOffset = pxGapToPercent(CARD_REGULAR.footprintH * 0.45);

  children.forEach((child, index) => {
    const row = index < firstRowCount ? 0 : 1;
    const colInRow = index < firstRowCount ? index : index - firstRowCount;
    const rowCount = row === 0 ? firstRowCount : children.length - firstRowCount;
    const rowStep = childStepPercent(rowCount);
    const offset = rowCount === 1 ? 0 : (colInRow - (rowCount - 1) / 2) * rowStep;

    positions.set(child.id, {
      x: clampX(centerX + offset),
      y: y - row * rowOffset,
    });
  });
}

/** Spread gen-2 branches across the canopy; wider zones for larger families. */
function layoutGen2Row(
  directChildren: PrototypeMember[],
  members: PrototypeMember[],
  positions: Map<number, { x: number; y: number }>,
): void {
  if (directChildren.length === 0) return;

  directChildren.sort((a, b) => a.id - b.id);

  const weights = directChildren.map((parent) => {
    const childCount = members.filter((member) => member.fatherId === parent.id).length;
    return Math.max(3, childCount + LAYOUT_GAPS.reserveSiblingSlots);
  });

  const gapPct = pxGapToPercent(LAYOUT_GAPS.branchZoneGap);
  const totalGaps = (directChildren.length - 1) * gapPct;
  const usable = OVERLAY_BOUNDS.maxX - OVERLAY_BOUNDS.minX - totalGaps;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const yBase = generationY(2);

  let cursor = OVERLAY_BOUNDS.minX;

  directChildren.forEach((child, index) => {
    const zoneWidth = (weights[index] / totalWeight) * usable;
    const centerX = cursor + zoneWidth / 2;
    const t = directChildren.length === 1 ? 0.5 : index / (directChildren.length - 1);
    const arcLift = Math.sin(t * Math.PI) * 1;

    positions.set(child.id, {
      x: clampX(centerX),
      y: yBase - arcLift,
    });

    cursor += zoneWidth + (index < directChildren.length - 1 ? gapPct : 0);
  });
}

/** Initial generation-based canopy layout (percent coordinates). */
export function computeCanopyLayout(members: PrototypeMember[]): PositionedMember[] {
  const positions = new Map<number, { x: number; y: number }>();
  const founder = members.find((member) => member.fatherId == null);
  if (!founder) {
    return members.map((member) => ({ ...member, x: member.x, y: member.y }));
  }

  positions.set(founder.id, { x: 50, y: generationY(1) });

  const directChildren = members.filter((member) => member.fatherId === founder.id);
  layoutGen2Row(directChildren, members, positions);

  directChildren.forEach((branchParent) => {
    const parentPos = positions.get(branchParent.id);
    if (!parentPos) return;

    const children = members
      .filter((member) => member.fatherId === branchParent.id)
      .sort((a, b) => a.id - b.id);

    if (children.length === 0) return;

    const childGeneration = children[0].generation;
    layoutSiblingCluster(
      children,
      parentPos.x,
      generationY(childGeneration),
      positions,
    );
  });

  const maxGen = Math.max(...members.map((member) => member.generation));
  if (maxGen >= 4) {
    const gen4Parents = new Set(
      members.filter((member) => member.generation === 4 && member.fatherId != null)
        .map((member) => member.fatherId as number),
    );

    gen4Parents.forEach((parentId) => {
      const parentPos = positions.get(parentId);
      if (!parentPos) return;
      const siblings = members.filter((item) => item.fatherId === parentId);
      layoutSiblingCluster(siblings, parentPos.x, generationY(4), positions);
    });
  }

  return members.map((member) => {
    const slot = positions.get(member.id);
    return {
      ...member,
      x: slot?.x ?? 50,
      y: slot?.y ?? generationY(member.generation),
    };
  });
}

/** Labels centered on the sibling connector rail between parent and children. */
export function computeBranchLabels(members: PositionedMember[]): PrototypeBranchLabel[] {
  const labels: PrototypeBranchLabel[] = [];

  members.forEach((parent) => {
    const children = members.filter((member) => member.fatherId === parent.id);
    if (children.length === 0) return;

    const avgX = children.reduce((sum, child) => sum + child.x, 0) / children.length;
    const topChildY = Math.min(...children.map((child) => child.y));
    const railY = parent.y - (parent.y - topChildY) * 0.42;

    labels.push({
      text: `أبناء ${parent.fullName}`,
      x: clampX(avgX),
      y: Math.max(OVERLAY_BOUNDS.minY + 2, railY),
    });
  });

  return labels;
}

export { getCardDimensions, isFounderMember };
