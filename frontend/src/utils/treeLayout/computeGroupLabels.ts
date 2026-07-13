import { cardHeightForMember, cardWidthForMember, isFounderMember } from './constants';
import { getMemberFirstName } from '../normalizeFamilyData';
import type { BranchLabel, PositionedMember } from './types';

const LABEL_OFFSET_Y = 26;
const LABEL_HEIGHT = 30;
const LABEL_PAD_X = 8;

interface LabelDraft {
  parentId: number;
  text: string;
  x: number;
  y: number;
  width: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function labelBox(draft: LabelDraft) {
  return {
    left: draft.left,
    right: draft.right,
    top: draft.top,
    bottom: draft.bottom,
  };
}

function boxesOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
  gap = 4,
): boolean {
  return !(
    a.right + gap <= b.left
    || b.right + gap <= a.left
    || a.bottom + gap <= b.top
    || b.bottom + gap <= a.top
  );
}

function resolveLabelCollisions(drafts: LabelDraft[]): LabelDraft[] {
  const sorted = [...drafts].sort((a, b) => a.y - b.y || a.left - b.left);
  const placed: LabelDraft[] = [];

  sorted.forEach((draft) => {
    let candidate = { ...draft };
    let safety = 0;

    while (safety < 12) {
      const box = labelBox(candidate);
      const cardHit = placed.some((other) => boxesOverlap(box, other, 6));
      if (!cardHit) break;

      candidate = {
        ...candidate,
        y: candidate.y - LABEL_HEIGHT - 4,
        top: candidate.top - LABEL_HEIGHT - 4,
        bottom: candidate.bottom - LABEL_HEIGHT - 4,
      };
      safety += 1;
    }

    placed.push(candidate);
  });

  return placed;
}

/** Dynamic family-group labels above each father's children row. */
export function computeGroupLabels(members: PositionedMember[]): BranchLabel[] {
  const drafts: LabelDraft[] = [];

  members.forEach((parent) => {
    if (isFounderMember(parent)) return;

    const children = members.filter((member) => member.fatherId === parent.id);
    if (children.length < 2) return;

    const parentName = getMemberFirstName(parent.fullName);
    const minX = Math.min(...children.map((child) => child.x));
    const maxX = Math.max(
      ...children.map((child) => child.x + cardWidthForMember(child)),
    );
    const childTop = Math.min(...children.map((child) => child.y));
    const labelX = (minX + maxX) / 2;
    const width = Math.max(72, Math.min(140, maxX - minX + 12));
    const labelY = childTop - LABEL_OFFSET_Y;

    drafts.push({
      parentId: parent.id,
      text: `أبناء ${parentName}`,
      x: labelX,
      y: labelY,
      width,
      left: labelX - width / 2 - LABEL_PAD_X,
      right: labelX + width / 2 + LABEL_PAD_X,
      top: labelY - LABEL_HEIGHT,
      bottom: labelY + 4,
    });
  });

  const cardBoxes = members.map((member) => ({
    left: member.x,
    right: member.x + cardWidthForMember(member),
    top: member.y - 12,
    bottom: member.y + cardHeightForMember(member),
  }));

  const filtered = drafts.filter((draft) => {
    const box = labelBox(draft);
    return !cardBoxes.some((card) => boxesOverlap(box, card, 2));
  });

  const resolved = resolveLabelCollisions(filtered);

  return resolved.map((draft) => ({
    parentId: draft.parentId,
    text: draft.text,
    x: draft.x,
    y: draft.y,
    width: draft.width,
  }));
}
