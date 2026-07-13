import type { ZoomTransform } from 'd3';
import type { TreeLayoutResult } from '../../types/tree';
import { getNodeHeight, getNodeWidth, WORLD_HEIGHT, WORLD_WIDTH } from '../../utils/nodeMetrics';

const DEBUG_TREE = false;
const DEBUG_ENABLED = import.meta.env.DEV && DEBUG_TREE;

interface TreeLayoutDebugProps {
  layout: TreeLayoutResult;
  transform: ZoomTransform;
}

export function TreeLayoutDebug({ layout, transform }: TreeLayoutDebugProps) {
  if (!DEBUG_ENABLED) {
    return null;
  }

  return (
    <g className="debug-layer" pointerEvents="none" opacity={0.65}>
      <rect
        x={0}
        y={0}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeDasharray="10 8"
      />

      <text x={16} y={28} fill="#1d4ed8" fontSize={14}>
        {`world ${WORLD_WIDTH}×${WORLD_HEIGHT} | zoom ${transform.k.toFixed(2)} | pan ${transform.x.toFixed(0)},${transform.y.toFixed(0)}`}
      </text>

      {layout.nodes.map((node) => {
        const w = getNodeWidth(node.data);
        const h = getNodeHeight(node.data);

        return (
          <g key={`debug-${node.id}`}>
            <rect
              x={node.worldX - w / 2}
              y={node.worldY - h / 2}
              width={w}
              height={h}
              fill="none"
              stroke="#dc2626"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={node.worldX}
              y={node.worldY - h / 2 - 6}
              textAnchor="middle"
              fill="#dc2626"
              fontSize={10}
            >
              {`${node.id} (${Math.round(node.worldX)}, ${Math.round(node.worldY)})`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function isTreeDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}
