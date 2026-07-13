import { cardBoxesCollide, memberCardBBox, MIN_CARD_GAP } from './cardBounds';
import { usableStageRect, type LayoutStage } from './stageBounds';
import type { PositionedMember } from './types';

export interface LayoutValidationReport {
  overlappingCards: number;
  clippedCards: number;
  hiddenNames: number;
  overlapPairs: Array<[number, number]>;
  valid: boolean;
}

export function findOverlappingPairs(
  members: PositionedMember[],
  gap = MIN_CARD_GAP,
): Array<[number, number]> {
  const boxes = members.map(memberCardBBox);
  const pairs: Array<[number, number]> = [];

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (cardBoxesCollide(boxes[i], boxes[j], gap)) {
        pairs.push([boxes[i].id, boxes[j].id]);
      }
    }
  }

  return pairs;
}

export function countOverlappingPairs(members: PositionedMember[]): number {
  return findOverlappingPairs(members).length;
}

export function validateLayout(
  members: PositionedMember[],
  stage: LayoutStage,
  skipClipCheck = false,
): LayoutValidationReport {
  const overlapPairs = findOverlappingPairs(members);
  let clippedCards = 0;

  if (!skipClipCheck) {
    const usable = usableStageRect(stage);
    members.forEach((member) => {
      const box = memberCardBBox(member);
      if (
        box.left < usable.left
        || box.right > usable.right
        || box.top < usable.top
        || box.bottom > usable.bottom
      ) {
        clippedCards += 1;
      }
    });
  }

  const overlappingCards = overlapPairs.length;
  const hiddenNames = 0;

  return {
    overlappingCards,
    clippedCards,
    hiddenNames,
    overlapPairs,
    valid: overlappingCards === 0 && clippedCards === 0 && hiddenNames === 0,
  };
}
