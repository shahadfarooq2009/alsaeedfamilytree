import type { PrototypeBranchLabel, PrototypeMember } from '../components/reference-tree/prototypeMembers';

/** Fixed map coordinate space (matches FamilyTreeMap reference). */
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 900;

/** Approved card size — coordinates offset from 118×82 reference layout. */
export const MAP_CARD_WIDTH = 96;
export const MAP_CARD_HEIGHT = 66;
const REF_CARD_WIDTH = 118;
const REF_CARD_HEIGHT = 82;
const COORD_OFFSET_X = (REF_CARD_WIDTH - MAP_CARD_WIDTH) / 2;
const COORD_OFFSET_Y = (REF_CARD_HEIGHT - MAP_CARD_HEIGHT) / 2;

const SIBLING_GAP = 18;
const BRANCH_ZONE_GAP = 36;
const GEN1_Y = 785;
const GEN2_Y = 610;
const PARENT_CHILD_GAP = 168;
const MAP_MARGIN = 40;

export interface MapPositionedMember extends PrototypeMember {
  x: number;
  y: number;
}

export interface MapConnectorPath {
  key: string;
  d: string;
  type: 'root' | 'main' | 'child';
}

function getTopCenter(member: MapPositionedMember) {
  return {
    x: member.x + MAP_CARD_WIDTH / 2,
    y: member.y,
  };
}

function getBottomCenter(member: MapPositionedMember) {
  return {
    x: member.x + MAP_CARD_WIDTH / 2,
    y: member.y + MAP_CARD_HEIGHT,
  };
}

/** Convert reference 118×82 top-left coords to approved 96×66 layout. */
export function toMapCoord(refX: number, refY: number): { x: number; y: number } {
  return {
    x: refX + COORD_OFFSET_X,
    y: refY + COORD_OFFSET_Y,
  };
}

export function applyMapPositions(members: PrototypeMember[]): MapPositionedMember[] {
  return members.map((member) => ({
    ...member,
    x: member.x + COORD_OFFSET_X,
    y: member.y + COORD_OFFSET_Y,
  }));
}

function clusterWidthRef(childCount: number): number {
  if (childCount <= 0) return REF_CARD_WIDTH;
  return childCount * REF_CARD_WIDTH + (childCount - 1) * SIBLING_GAP;
}

function branchZoneWidthRef(childCount: number): number {
  return Math.max(REF_CARD_WIDTH, clusterWidthRef(childCount)) + 24;
}

/** Compute hierarchy-based positions: each child group sits above its own parent. */
export function computeFamilyTreeMapLayout(members: PrototypeMember[]): MapPositionedMember[] {
  const refPositions = new Map<number, { x: number; y: number }>();
  const founder = members.find((member) => member.fatherId == null);
  if (!founder) {
    return applyMapPositions(members);
  }

  refPositions.set(founder.id, {
    x: (MAP_WIDTH - REF_CARD_WIDTH) / 2,
    y: GEN1_Y,
  });

  const gen2Parents = members
    .filter((member) => member.fatherId === founder.id)
    .sort((a, b) => a.id - b.id);

  const zoneWidths = gen2Parents.map((parent) => {
    const childCount = members.filter((member) => member.fatherId === parent.id).length;
    return branchZoneWidthRef(childCount);
  });

  const totalGaps = (gen2Parents.length - 1) * BRANCH_ZONE_GAP;
  const totalZones = zoneWidths.reduce((sum, width) => sum + width, 0);
  const usable = MAP_WIDTH - MAP_MARGIN * 2 - totalGaps;

  let branchGap = BRANCH_ZONE_GAP;
  let adjustedTotal = totalZones + totalGaps;
  while (adjustedTotal > usable && branchGap > 22) {
    branchGap -= 4;
    adjustedTotal = totalZones + (gen2Parents.length - 1) * branchGap;
  }

  let cursor = MAP_MARGIN;

  gen2Parents.forEach((parent, index) => {
    const zoneW = zoneWidths[index];
    const centerX = cursor + zoneW / 2;

    refPositions.set(parent.id, {
      x: centerX - REF_CARD_WIDTH / 2,
      y: GEN2_Y,
    });

    const children = members
      .filter((member) => member.fatherId === parent.id)
      .sort((a, b) => a.id - b.id);

    if (children.length > 0) {
      const clusterW = clusterWidthRef(children.length);
      let startX = centerX - clusterW / 2;
      const maxX = MAP_WIDTH - MAP_MARGIN - clusterW;
      startX = Math.min(Math.max(startX, MAP_MARGIN), maxX);

      const childY = GEN2_Y - PARENT_CHILD_GAP;

      children.forEach((child, childIndex) => {
        refPositions.set(child.id, {
          x: startX + childIndex * (REF_CARD_WIDTH + SIBLING_GAP),
          y: childY,
        });
      });
    }

    cursor += zoneW + branchGap;
  });

  return members.map((member) => {
    const pos = refPositions.get(member.id);
    const refX = pos?.x ?? member.x;
    const refY = pos?.y ?? member.y;
    return {
      ...member,
      x: refX + COORD_OFFSET_X,
      y: refY + COORD_OFFSET_Y,
    };
  });
}

function createRootConnector(parent: MapPositionedMember, child: MapPositionedMember): string {
  const parentTop = getTopCenter(parent);
  const childBottom = getBottomCenter(child);
  const middleY = parentTop.y - 52;

  return `
    M ${parentTop.x} ${parentTop.y}
    C ${parentTop.x} ${middleY},
      ${childBottom.x} ${middleY},
      ${childBottom.x} ${childBottom.y}
  `.trim();
}

function createFamilyConnector(
  parent: MapPositionedMember,
  children: MapPositionedMember[],
): MapConnectorPath[] {
  if (children.length === 0) return [];

  const parentTop = getTopCenter(parent);
  const childCenters = children.map(getBottomCenter);
  const minX = Math.min(...childCenters.map((point) => point.x));
  const maxX = Math.max(...childCenters.map((point) => point.x));
  const splitX = (minX + maxX) / 2;
  const splitY = parentTop.y - 72;

  const paths: MapConnectorPath[] = [
    {
      key: `stem-${parent.id}`,
      d: `
        M ${parentTop.x} ${parentTop.y}
        C ${parentTop.x} ${parentTop.y - 25},
          ${splitX} ${splitY + 25},
          ${splitX} ${splitY}
      `.trim(),
      type: 'main',
    },
  ];

  children.forEach((child) => {
    const childBottom = getBottomCenter(child);
    const controlOffset = Math.max(25, Math.abs(childBottom.x - splitX) * 0.35);

    paths.push({
      key: `child-${parent.id}-${child.id}`,
      d: `
        M ${splitX} ${splitY}
        C ${
          childBottom.x < splitX ? splitX - controlOffset : splitX + controlOffset
        } ${splitY},
          ${childBottom.x} ${childBottom.y + 35},
          ${childBottom.x} ${childBottom.y}
      `.trim(),
      type: 'child',
    });
  });

  return paths;
}

export function buildMapConnectors(members: MapPositionedMember[]): MapConnectorPath[] {
  const founder = members.find((member) => member.fatherId == null);
  if (!founder) return [];

  const generationTwo = members.filter((member) => member.fatherId === founder.id);

  const rootPaths: MapConnectorPath[] = generationTwo.map((child) => ({
    key: `root-${child.id}`,
    d: createRootConnector(founder, child),
    type: 'root',
  }));

  const familyPaths = generationTwo.flatMap((parent) => {
    const children = members.filter((member) => member.fatherId === parent.id);
    return createFamilyConnector(parent, children);
  });

  return [...rootPaths, ...familyPaths];
}

const LABEL_WIDTH = 95;
const LABEL_OFFSET_Y = 48;

export function computeMapBranchLabels(members: MapPositionedMember[]): PrototypeBranchLabel[] {
  const labels: PrototypeBranchLabel[] = [];

  members.forEach((parent) => {
    const children = members.filter((member) => member.fatherId === parent.id);
    if (children.length === 0 || parent.generation !== 2) return;

    const minX = Math.min(...children.map((child) => child.x));
    const maxX = Math.max(...children.map((child) => child.x + MAP_CARD_WIDTH));
    const labelX = (minX + maxX) / 2;
    const labelY = Math.min(...children.map((child) => child.y)) - LABEL_OFFSET_Y;

    labels.push({
      text: `أبناء ${parent.fullName}`,
      x: labelX,
      y: labelY,
      width: LABEL_WIDTH,
    });
  });

  return labels;
}
