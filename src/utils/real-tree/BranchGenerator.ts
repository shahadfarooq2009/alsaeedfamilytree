export interface BranchPathResult {
  path: string;
  thickness: number;
}

/** Organic quadratic branch stroke between two flow edge anchors. */
export function buildBranchPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  depth: number,
  subtreeSize: number,
): BranchPathResult {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const bendX = midX + (targetY - sourceY) * 0.1;
  const bendY = midY - (targetX - sourceX) * 0.06;
  const path = `M ${sourceX} ${sourceY} Q ${bendX} ${bendY} ${targetX} ${targetY}`;
  const thickness = Math.max(
    1.5,
    9 - depth * 0.75 + Math.min(Math.max(subtreeSize, 1), 8) * 0.35,
  );

  return { path, thickness };
}
