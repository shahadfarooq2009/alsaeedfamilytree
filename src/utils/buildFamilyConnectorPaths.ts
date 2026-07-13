/** Card anchor points in overlay pixel coordinates (from getBoundingClientRect). */
export interface CardAnchor {
  id: number;
  cx: number;
  top: number;
  bottom: number;
}

export interface FamilyConnectorPaths {
  groupId: number;
  halos: string;
  stems: string;
  siblingRails: string;
  childDrops: string;
  junctions: string;
  buds: string;
  /** Sibling rail Y in pixels — used for label placement. */
  railY: number | null;
}

const STEM_LENGTH = 22;
const MIN_STEM = 14;
const MAX_STEM = 30;

function stemPath(x: number, yStart: number, yEnd: number): string {
  const mid = (yStart + yEnd) / 2;
  return `M ${x} ${yStart} C ${x - 2} ${mid}, ${x + 2} ${mid}, ${x} ${yEnd}`;
}

function siblingRailPath(x1: number, x2: number, y: number): string {
  if (Math.abs(x2 - x1) < 2) return '';
  const midX = (x1 + x2) / 2;
  const bow = Math.min(7, Math.abs(x2 - x1) * 0.045);
  return `M ${x1} ${y} Q ${midX} ${y - bow}, ${x2} ${y}`;
}

function childDropPath(cx: number, railY: number, childBottom: number): string {
  const mid = (railY + childBottom) / 2;
  return `M ${cx} ${railY} C ${cx} ${mid - 2}, ${cx} ${mid + 2}, ${cx} ${childBottom}`;
}

function singleChildPath(
  parentCx: number,
  parentTop: number,
  childCx: number,
  childBottom: number,
): string {
  const midY = (parentTop + childBottom) / 2;
  const c1x = parentCx + (childCx - parentCx) * 0.1;
  const c2x = parentCx + (childCx - parentCx) * 0.75;
  return `M ${parentCx} ${parentTop} C ${c1x} ${midY - 4}, ${c2x} ${midY + 3}, ${childCx} ${childBottom}`;
}

function computeRailY(parentTop: number, childBottoms: number[]): number {
  const nearestChild = Math.max(...childBottoms);
  const gap = parentTop - nearestChild;
  const stem = Math.min(MAX_STEM, Math.max(MIN_STEM, gap * 0.38, STEM_LENGTH));
  return parentTop - stem;
}

/** Build bracket-style paths: parent → stem → sibling rail → child drops. */
export function buildFamilyGroupPaths(
  groupId: number,
  parent: CardAnchor,
  children: CardAnchor[],
): FamilyConnectorPaths | null {
  if (children.length === 0) return null;

  const sorted = [...children].sort((a, b) => a.cx - b.cx);
  const parentTop = parent.top - 2;
  const childPoints = sorted.map((child) => ({
    cx: child.cx,
    y: child.bottom + 2,
  }));

  let halos = '';
  let stems = '';
  let siblingRails = '';
  let childDrops = '';
  let junctions = '';
  let buds = '';

  if (childPoints.length === 1) {
    const child = childPoints[0];
    const d = singleChildPath(parent.cx, parentTop, child.cx, child.y);
    halos += `<path class="halo branch" data-group="${groupId}" d="${d}" />`;
    childDrops += `<path class="conn branch" data-group="${groupId}" d="${d}" />`;
    junctions += `<circle class="junction junction-sm" cx="${parent.cx}" cy="${parentTop}" r="2.2" />`;
    buds += `<circle class="bud" cx="${child.cx}" cy="${child.y}" r="2" />`;
    return { groupId, halos, stems, siblingRails, childDrops, junctions, buds, railY: null };
  }

  const railY = computeRailY(parentTop, childPoints.map((c) => c.y));
  const railLeft = Math.min(sorted[0].cx, parent.cx);
  const railRight = Math.max(sorted[sorted.length - 1].cx, parent.cx);

  const stemD = stemPath(parent.cx, parentTop, railY);
  halos += `<path class="halo stem" data-group="${groupId}" d="${stemD}" />`;
  stems += `<path class="conn stem" data-group="${groupId}" d="${stemD}" />`;

  const railD = siblingRailPath(railLeft, railRight, railY);
  if (railD) {
    halos += `<path class="halo sibling-rail" data-group="${groupId}" d="${railD}" />`;
    siblingRails += `<path class="conn sibling-rail" data-group="${groupId}" d="${railD}" />`;
  }

  childPoints.forEach((child) => {
    const dropD = childDropPath(child.cx, railY, child.y);
    halos += `<path class="halo child-drop" data-group="${groupId}" d="${dropD}" />`;
    childDrops += `<path class="conn child-drop" data-group="${groupId}" d="${dropD}" />`;
    buds += `<circle class="bud" cx="${child.cx}" cy="${child.y}" r="2" />`;
  });

  junctions += `<circle class="junction" cx="${parent.cx}" cy="${railY}" r="2.4" />`;
  junctions += `<circle class="junction junction-sm" cx="${parent.cx}" cy="${parentTop}" r="2" />`;

  return { groupId, halos, stems, siblingRails, childDrops, junctions, buds, railY };
}

/** Build connector paths for every parent with children. */
export function buildAllFamilyConnectors(
  members: Array<{ id: number; fatherId: number | null }>,
  getAnchor: (id: number) => CardAnchor | null,
): FamilyConnectorPaths[] {
  const childMap = new Map<number, number[]>();

  members.forEach((member) => {
    if (member.fatherId == null) return;
    const list = childMap.get(member.fatherId) ?? [];
    list.push(member.id);
    childMap.set(member.fatherId, list);
  });

  const results: FamilyConnectorPaths[] = [];

  childMap.forEach((childIds, parentId) => {
    const parent = getAnchor(parentId);
    if (!parent) return;

    const childAnchors = childIds
      .map((id) => getAnchor(id))
      .filter((anchor): anchor is CardAnchor => anchor != null);

    if (childAnchors.length === 0) return;

    const paths = buildFamilyGroupPaths(parentId, parent, childAnchors);
    if (paths) results.push(paths);
  });

  return results.sort((a, b) => a.groupId - b.groupId);
}
