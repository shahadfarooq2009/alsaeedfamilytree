import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

import {
  buildRoundedHorizontalBusPath,
  buildRoundedVerticalDropPath,
} from '../../utils/familyForest/buildRoundedConnectorPath';

export interface ForestFounderRailData extends Record<string, unknown> {
  founderBottom: { x: number; y: number };
  branchTops: Array<{ x: number; y: number }>;
  founderStemHeight: number;
}

function ForestFounderRailComponent({
  data,
  width,
  height,
}: NodeProps<Node<ForestFounderRailData>>) {
  if (!data) return null;

  const { founderBottom, branchTops } = data;
  if (branchTops.length === 0) return null;

  const svgWidth = Math.max(1, Number(width) || 1);
  const svgHeight = Math.max(1, Number(height) || 1);
  const railY = founderBottom.y;
  const sortedBranchTops = [...branchTops].sort((left, right) => left.x - right.x);
  const leftX = sortedBranchTops[0].x;
  const rightX = sortedBranchTops[sortedBranchTops.length - 1].x;
  const busPath = buildRoundedHorizontalBusPath(leftX, rightX, railY);

  return (
    <svg
      className="family-forest-founder-rail"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden
    >
      {busPath ? (
        <path
          d={busPath}
          className="family-forest-founder-rail__line"
        />
      ) : null}
      <circle
        cx={founderBottom.x}
        cy={railY}
        r={4}
        className="family-forest-founder-rail__node"
      />
      {sortedBranchTops.map((point, index) => {
        const isSingleBranch = leftX === rightX;
        const cornerSide = isSingleBranch
          ? 'none'
          : point.x === leftX
            ? 'left'
            : point.x === rightX
              ? 'right'
              : 'none';

        return (
          <path
            key={`branch-drop-${index}`}
            d={buildRoundedVerticalDropPath(point.x, point.y, cornerSide, railY)}
            className="family-forest-founder-rail__line"
          />
        );
      })}
    </svg>
  );
}

export const ForestFounderRail = memo(ForestFounderRailComponent);
