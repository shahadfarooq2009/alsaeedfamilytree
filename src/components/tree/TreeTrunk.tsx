import { trunkLayout, treeAssets } from '../../features/family-tree/theme/treeAssets';
import { WORLD_WIDTH } from '../../utils/nodeMetrics';

/** Approved transparent trunk — bottom center, roots on ground shadow. */
export function TreeTrunk() {
  const groundY = trunkLayout.bottomY;
  const shadowRx = trunkLayout.width * 0.68;
  const shadowRy = trunkLayout.width * 0.09;

  return (
    <g pointerEvents="none" aria-hidden className="tree-trunk">
      <ellipse
        cx={trunkLayout.centerX}
        cy={groundY + 10}
        rx={shadowRx}
        ry={shadowRy}
        fill="rgba(58, 48, 38, 0.14)"
      />
      <ellipse
        cx={trunkLayout.centerX}
        cy={groundY + 5}
        rx={shadowRx * 0.7}
        ry={shadowRy * 0.5}
        fill="rgba(58, 48, 38, 0.09)"
      />

      {[ -0.22, -0.1, 0.08, 0.2, 0.32 ].map((offset, index) => (
        <ellipse
          key={`rock-${index}`}
          cx={trunkLayout.centerX + trunkLayout.width * offset}
          cy={groundY - 4 + (index % 2) * 3}
          rx={18 + (index % 3) * 8}
          ry={10 + (index % 2) * 4}
          fill="#b8b0a4"
          opacity={0.55}
        />
      ))}

      <image
        href={treeAssets.trunk}
        x={trunkLayout.x}
        y={trunkLayout.y}
        width={trunkLayout.width}
        height={trunkLayout.height}
        preserveAspectRatio="xMidYMax meet"
      />

      <rect
        x={0}
        y={groundY - 2}
        width={WORLD_WIDTH}
        height={22}
        fill="url(#ground-fade)"
        opacity={0.42}
      />
    </g>
  );
}
