import { motion } from 'framer-motion';
import type { BranchInstance } from '../../types/branchInstance';
import { treeAssets } from '../../features/family-tree/theme/treeAssets';
import { BRANCH_ASSET_META } from '../../utils/branchAssetMeta';

interface ImageBranchLayerProps {
  branches: BranchInstance[];
  growingChildId: number | null;
}

export function ImageBranchLayer({ branches, growingChildId }: ImageBranchLayerProps) {
  return (
    <g className="image-branches" pointerEvents="none" aria-hidden>
      {branches.map((branch) => {
        const href = treeAssets.branches[branch.asset];
        const meta = BRANCH_ASSET_META[branch.asset];
        const originX = meta.base.x * branch.width;
        const originY = meta.base.y * branch.height;
        const isGrowing = growingChildId !== null && branch.childPersonId === growingChildId;
        const delay =
          branch.asset === 'hanging-stem'
            ? 0.35 + branch.segmentIndex * 0.12
            : branch.segmentIndex * 0.14;

        return (
          <g
            key={branch.id}
            transform={`translate(${branch.x}, ${branch.y}) rotate(${branch.rotation})${branch.flipX ? ' scale(-1,1)' : ''}`}
          >
            <motion.image
              href={href}
              x={0}
              y={0}
              width={branch.width}
              height={branch.height}
              preserveAspectRatio="xMidYMid meet"
              initial={
                isGrowing
                  ? { opacity: 0, scale: 0.02 }
                  : { opacity: 1, scale: 1 }
              }
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: isGrowing ? 0.55 : 0,
                delay: isGrowing ? delay : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transformOrigin: `${originX}px ${originY}px`,
                transformBox: 'fill-box' as const,
              }}
            />
          </g>
        );
      })}
    </g>
  );
}
