import { cardBoxesCollide, memberCardBBox, MIN_CARD_GAP } from './cardBounds';
import { mainBranchUsableRect, type LayoutStage } from './stageBounds';
import type { BranchConnectorPath, PositionedMember } from './types';

export interface LayoutValidationReport {
  overlappingCards: number;
  clippedCards: number;
  hiddenNames: number;
  overlapPairs: Array<[number, number]>;
  valid: boolean;
  totalMembers?: number;
  founderDirectChildrenCount?: number;
  mainBranchCount?: number;
  membersPerMainBranch?: Record<number, number>;
  unresolvedPrimaryParentCount?: number;
  cardsOutsideBounds?: number;
  crossBranchConnectorCount?: number;
  connectorCardIntersectionCount?: number;
  unusedLeftWidth?: number;
  unusedRightWidth?: number;
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

function countCardsOutsideBounds(
  members: PositionedMember[],
  stage: LayoutStage,
): number {
  const usable = mainBranchUsableRect(stage);
  let count = 0;
  members.forEach((member) => {
    const box = memberCardBBox(member);
    if (
      box.left < usable.left
      || box.right > usable.right
      || box.top < usable.top
      || box.bottom > usable.bottom
    ) {
      count += 1;
    }
  });
  return count;
}

function parsePathSegments(d: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const commands = d.match(/[MLQ][^MLQ]*/g) ?? [];
  let cursor = { x: 0, y: 0 };

  commands.forEach((command) => {
    const type = command[0];
    const nums = command.slice(1).trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
    if (type === 'M' && nums.length >= 2) {
      cursor = { x: nums[0], y: nums[1] };
      return;
    }
    if (type === 'L' && nums.length >= 2) {
      const next = { x: nums[0], y: nums[1] };
      segments.push({ x1: cursor.x, y1: cursor.y, x2: next.x, y2: next.y });
      cursor = next;
    }
  });

  return segments;
}

function segmentIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: ReturnType<typeof memberCardBBox>,
  padding = 2,
): boolean {
  const left = box.left - padding;
  const right = box.right + padding;
  const top = box.top - padding;
  const bottom = box.bottom + padding;

  if (x1 === x2 && y1 === y2) {
    return x1 >= left && x1 <= right && y1 >= top && y1 <= bottom;
  }

  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= left && x <= right && y >= top && y <= bottom) return true;
  }
  return false;
}

export function countConnectorCardIntersections(
  members: PositionedMember[],
  connectors: BranchConnectorPath[],
): number {
  const boxes = members.map(memberCardBBox);
  let count = 0;

  connectors.forEach((connector) => {
    const segments = parsePathSegments(connector.d);
    segments.forEach((segment) => {
      boxes.forEach((box) => {
        if (box.id === connector.parentId || box.id === connector.childId) return;
        if (segmentIntersectsBox(segment.x1, segment.y1, segment.x2, segment.y2, box)) {
          count += 1;
        }
      });
    });
  });

  return count;
}

export function countCrossBranchConnectors(
  members: PositionedMember[],
  connectors: BranchConnectorPath[],
): number {
  const byId = new Map(members.map((member) => [member.id, member]));
  let count = 0;

  connectors.forEach((connector) => {
    if (connector.key.startsWith('split-')) return;
    const parent = byId.get(connector.parentId);
    const child = byId.get(connector.childId);
    if (!parent || !child) return;
    if (
      parent.mainBranchRootId != null
      && child.mainBranchRootId != null
      && parent.mainBranchRootId !== child.mainBranchRootId
    ) {
      count += 1;
    }
  });

  return count;
}

export function validateLayout(
  members: PositionedMember[],
  stage: LayoutStage,
  connectors: BranchConnectorPath[] = [],
  extra: Partial<LayoutValidationReport> = {},
): LayoutValidationReport {
  const overlapPairs = findOverlappingPairs(members);
  const clippedCards = countCardsOutsideBounds(members, stage);
  const overlappingCards = overlapPairs.length;
  const hiddenNames = 0;
  const crossBranchConnectorCount = countCrossBranchConnectors(members, connectors);
  const connectorCardIntersectionCount = countConnectorCardIntersections(members, connectors);

  return {
    overlappingCards,
    clippedCards,
    hiddenNames,
    overlapPairs,
    valid:
      overlappingCards === 0
      && clippedCards === 0
      && hiddenNames === 0
      && crossBranchConnectorCount === 0
      && connectorCardIntersectionCount === 0,
    cardsOutsideBounds: clippedCards,
    crossBranchConnectorCount,
    connectorCardIntersectionCount,
    ...extra,
  };
}
