import type { TreeLayoutResult } from '../../types/tree';
import type { ZoomTransform } from 'd3';
import { trunkLayout } from '../../features/family-tree/theme/treeAssets';

interface TreeMinimapProps {
  layout: TreeLayoutResult;
  transform: ZoomTransform;
  viewportWidth: number;
  viewportHeight: number;
}

/** Bottom-left minimap — reference-style overview. */
export function TreeMinimap({
  layout,
  transform,
  viewportWidth,
  viewportHeight,
}: TreeMinimapProps) {
  if (layout.nodes.length === 0 || viewportWidth === 0 || viewportHeight === 0) {
    return null;
  }

  const mapW = 168;
  const mapH = 108;
  const { bounds } = layout;
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const scale = Math.min(mapW / worldW, mapH / worldH) * 0.9;
  const offsetX = (mapW - worldW * scale) / 2 - bounds.minX * scale;
  const offsetY = (mapH - worldH * scale) / 2 - bounds.minY * scale;

  const viewW = viewportWidth / transform.k;
  const viewH = viewportHeight / transform.k;
  const viewX = -transform.x / transform.k;
  const viewY = -transform.y / transform.k;

  return (
    <div
      className="pointer-events-none absolute bottom-5 left-5 z-20 hidden rounded-2xl border p-2 backdrop-blur-md md:block"
      style={{
        background: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(201, 162, 39, 0.2)',
        boxShadow: '0 8px 28px rgba(47, 54, 40, 0.1)',
      }}
    >
      <svg width={mapW} height={mapH} aria-hidden className="rounded-xl">
        <rect width={mapW} height={mapH} fill="#f3efe8" rx={10} />
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
          <ellipse
            cx={trunkLayout.centerX}
            cy={trunkLayout.bottomY - trunkLayout.height * 0.35}
            rx={trunkLayout.width * 0.42}
            ry={trunkLayout.height * 0.38}
            fill="#8fa67a"
            opacity={0.35}
          />
          {layout.nodes.map((node) => (
            <circle
              key={node.id}
              cx={node.worldX}
              cy={node.worldY}
              r={node.depth === 0 ? 16 : 9}
              fill={node.depth === 0 ? '#c9a227' : '#6f8a57'}
              opacity={0.8}
            />
          ))}
          <rect
            x={viewX}
            y={viewY}
            width={viewW}
            height={viewH}
            fill="rgba(201, 162, 39, 0.08)"
            stroke="#c9a227"
            strokeWidth={4 / scale}
            rx={10 / scale}
            opacity={0.9}
          />
        </g>
      </svg>
    </div>
  );
}
