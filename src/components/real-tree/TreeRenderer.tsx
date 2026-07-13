import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

import { buildBranchPath } from '../../utils/real-tree/BranchGenerator';

/** SVG organic branch edge for Real Tree View. */
export function RealTreeBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const depth = typeof data?.depth === 'number' ? data.depth : 3;
  const subtreeSize = typeof data?.subtreeSize === 'number' ? data.subtreeSize : 1;
  const organic = buildBranchPath(sourceX, sourceY, targetX, targetY, depth, subtreeSize);

  const [fallbackPath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 18,
    offset: 12,
  });

  return (
    <BaseEdge
      id={id}
      path={organic.path || fallbackPath}
      style={{
        ...style,
        strokeWidth: organic.thickness,
        strokeLinecap: 'round',
      }}
      markerEnd={markerEnd}
    />
  );
}
