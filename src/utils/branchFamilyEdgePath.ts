export interface BranchFamilyEdgeData extends Record<string, unknown> {
  routing: 'classic';
  busY: number;
  trunkX: number;
  dropX: number;
  busMinX: number;
  busMaxX: number;
  /** Primary edge draws trunk + horizontal bus; others draw only vertical drop. */
  segment: 'trunkBusDrop' | 'dropOnly';
}

/** Classic orthogonal genealogy path — straight segments, 90° turns only. */
export function buildBranchFamilyEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  data?: BranchFamilyEdgeData,
): string {
  if (!data || data.routing !== 'classic') {
    return buildFallbackClassicPath(sourceX, sourceY, targetX, targetY);
  }

  const { busY, trunkX, dropX, busMinX, busMaxX, segment } = data;

  if (segment === 'dropOnly') {
    return `M ${dropX} ${busY} L ${dropX} ${targetY}`;
  }

  const dy = targetY - sourceY;
  if (dy <= 1 || Math.abs(dropX - trunkX) < 2) {
    return `M ${trunkX} ${sourceY} L ${dropX} ${targetY}`;
  }

  const parts: string[] = [`M ${trunkX} ${sourceY}`, `L ${trunkX} ${busY}`];

  if (busMinX < trunkX - 1) {
    parts.push(`L ${busMinX} ${busY}`);
  }

  if (busMaxX > trunkX + 1 || busMinX >= trunkX) {
    parts.push(`L ${busMaxX} ${busY}`);
  }

  parts.push(`M ${dropX} ${busY}`, `L ${dropX} ${targetY}`);

  return parts.join(' ');
}

function buildFallbackClassicPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const dy = targetY - sourceY;
  if (dy <= 1 || Math.abs(targetX - sourceX) < 2) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  const busY = sourceY + dy * 0.5;
  return [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${busY}`,
    `L ${targetX} ${busY}`,
    `M ${targetX} ${busY}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');
}
