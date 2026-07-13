import type { PositionedLink, TreeLayoutResult } from '../../types/tree';
import { treeAssets } from '../../features/family-tree/theme/treeAssets';
import { referenceComposition } from '../../utils/referenceComposition';
import { getTreeDensityMode } from '../../utils/nodeMetrics';
import { cubicPoint, getLinkControlPoints } from '../../utils/treeLayout';

interface CanopyFoliageProps {
  layout: TreeLayoutResult;
}

const FOLIAGE_NATIVE = 1254;

interface FoliagePlacement {
  key: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  opacity: number;
  flip: number;
}

function hash(id: number, salt: number): number {
  return ((id * 9301 + salt * 49297) % 233280) / 233280;
}

/**
 * Foliage attached to real branch paths and person nodes only — shapes the canopy silhouette.
 */
export function CanopyFoliage({ layout }: CanopyFoliageProps) {
  const count = layout.nodes.length;
  if (count <= 1) {
    return null;
  }

  const mode = getTreeDensityMode(count);
  const density = referenceComposition.foliage[mode];
  const placements: FoliagePlacement[] = [];

  layout.links.forEach((link) => {
    addLinkFoliage(placements, link, density.perLink);
  });

  layout.nodes.forEach((node) => {
    if (node.depth === 0) {
      return;
    }

    for (let i = 0; i < density.perNode; i += 1) {
      const h = hash(node.id, i + 11);
      const side = h > 0.5 ? 1 : -1;
      const size = 42 + h * 58;

      placements.push({
        key: `node-foliage-${node.id}-${i}`,
        x: node.worldX + side * (14 + h * 28),
        y: node.worldY - (18 + h * 32),
        size,
        rotate: side * (10 + h * 28),
        opacity: 0.48 + h * 0.32,
        flip: side,
      });
    }
  });

  if (placements.length === 0) {
    return null;
  }

  return (
    <g pointerEvents="none" aria-hidden className="canopy-foliage">
      {placements.map((cluster) => (
        <g
          key={cluster.key}
          transform={`translate(${cluster.x}, ${cluster.y}) rotate(${cluster.rotate}) scale(${cluster.flip * (cluster.size / FOLIAGE_NATIVE)}, ${cluster.size / FOLIAGE_NATIVE})`}
          opacity={cluster.opacity}
        >
          <image
            href={treeAssets.foliageClusters}
            x={-FOLIAGE_NATIVE / 2}
            y={-FOLIAGE_NATIVE / 2}
            width={FOLIAGE_NATIVE}
            height={FOLIAGE_NATIVE}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      ))}
    </g>
  );
}

function addLinkFoliage(
  placements: FoliagePlacement[],
  link: PositionedLink,
  clustersPerLink: number,
): void {
  const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y } = getLinkControlPoints(link);

  for (let i = 1; i <= clustersPerLink; i += 1) {
    const t = i / (clustersPerLink + 1);
    const point = cubicPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
    const h = hash(link.source.id + link.target.id, i);
    const side = link.target.worldX >= link.source.worldX ? 1 : -1;
    const size = 34 + h * 52;

    placements.push({
      key: `foliage-${link.source.id}-${link.target.id}-${i}`,
      x: point.x + side * (6 + h * 22),
      y: point.y + (h - 0.5) * 18,
      size,
      rotate: side * (12 + h * 36),
      opacity: 0.42 + h * 0.38,
      flip: h > 0.55 ? -1 : 1,
    });

    if (t > 0.55 && h > 0.35) {
      placements.push({
        key: `twig-tip-${link.source.id}-${link.target.id}-${i}`,
        x: point.x - side * (10 + h * 16),
        y: point.y + (h - 0.4) * 12,
        size: 22 + h * 28,
        rotate: -side * (18 + h * 26),
        opacity: 0.38 + h * 0.28,
        flip: side,
      });
    }
  }

  const tip = cubicPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, 0.92);
  const h = hash(link.target.id, 99);
  placements.push({
    key: `tip-cluster-${link.source.id}-${link.target.id}`,
    x: tip.x + (h - 0.5) * 20,
    y: tip.y - 8,
    size: 36 + h * 40,
    rotate: (h - 0.5) * 50,
    opacity: 0.5 + h * 0.25,
    flip: h > 0.5 ? 1 : -1,
  });
}
