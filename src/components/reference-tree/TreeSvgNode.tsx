import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import treeBackground from '../../assets/family-tree/reference/tree-background.svg';

function TreeSvgNodeComponent({ width, height }: NodeProps) {
  const nodeWidth = width ?? 1920;
  const nodeHeight = height ?? 1080;

  return (
    <div
      className="family-tree-flow-svg-bg-wrap"
      style={{ width: nodeWidth, height: nodeHeight }}
    >
      <img
        src={treeBackground}
        alt=""
        className="family-tree-flow-svg-bg"
        draggable={false}
        decoding="async"
        loading="eager"
      />
    </div>
  );
}

export const TreeSvgNode = memo(TreeSvgNodeComponent);
