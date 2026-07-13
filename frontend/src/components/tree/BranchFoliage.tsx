import type { BranchInstance } from '../../types/branchInstance';
import { treeAssets } from '../../features/family-tree/theme/treeAssets';
import { getFoliagePointsAlongBranch } from '../../utils/buildBranchInstances';

interface BranchFoliageProps {
  branches: BranchInstance[];
}

const FOLIAGE_NATIVE = 1254;

function hash(id: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) % 10000;
  }
  return ((h + salt * 97) % 1000) / 1000;
}

/** Foliage clusters placed along image branch instances only. */
export function BranchFoliage({ branches }: BranchFoliageProps) {
  if (branches.length === 0) {
    return null;
  }

  const placements: Array<{
    key: string;
    x: number;
    y: number;
    size: number;
    rotate: number;
    opacity: number;
    flip: number;
  }> = [];

  branches.forEach((branch) => {
    if (branch.asset === 'hanging-stem') {
      return;
    }

    const points = getFoliagePointsAlongBranch(branch);
    points.forEach((point, index) => {
      const h = hash(branch.id, index);
      const side = branch.attachmentEnd.x >= branch.attachmentStart.x ? 1 : -1;
      placements.push({
        key: `bf-${branch.id}-${index}`,
        x: point.x + side * (8 + h * 18),
        y: point.y + (h - 0.5) * 14,
        size: 32 + h * 48,
        rotate: side * (10 + h * 24),
        opacity: 0.4 + h * 0.3,
        flip: h > 0.5 ? -1 : 1,
      });
    });
  });

  if (placements.length === 0) {
    return null;
  }

  return (
    <g pointerEvents="none" aria-hidden className="branch-foliage">
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
