import { memo, type CSSProperties } from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';

import { buildRoundedConnectorPath } from '../../utils/familyForest/buildRoundedConnectorPath';

interface ForestLocalEdgeData {
  branchColor?: string;
  highlighted?: boolean;
  parentBottom?: { x: number; y: number };
  childTop?: { x: number; y: number };
}

function ForestLocalEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}: EdgeProps) {
  const edgeData = data as ForestLocalEdgeData | undefined;
  const sx = edgeData?.parentBottom?.x ?? sourceX;
  const sy = edgeData?.parentBottom?.y ?? sourceY;
  const tx = edgeData?.childTop?.x ?? targetX;
  const ty = edgeData?.childTop?.y ?? targetY;

  const midY = sy + Math.max(10, (ty - sy) * 0.42);
  const path = buildRoundedConnectorPath(sx, sy, tx, ty, midY);

  return (
    <BaseEdge
      path={path}
      style={{
        ...style,
        stroke: edgeData?.branchColor ?? style?.stroke,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  );
}

export const ForestLocalEdge = memo(ForestLocalEdgeComponent);
