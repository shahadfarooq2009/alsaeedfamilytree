import { memo } from 'react';
import { type EdgeProps } from '@xyflow/react';

import {
  buildBranchFamilyEdgePath,
  type BranchFamilyEdgeData,
} from '../../utils/branchFamilyEdgePath';

export const BRANCH_EDGE_STROKE_PX = 2.5;

function BranchFamilyEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const path = buildBranchFamilyEdgePath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    data as BranchFamilyEdgeData | undefined,
  );

  return (
    <g className="branch-family-edge">
      <path
        d={path}
        fill="none"
        className="branch-family-edge__stroke"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export const BranchFamilyEdge = memo(BranchFamilyEdgeComponent);
