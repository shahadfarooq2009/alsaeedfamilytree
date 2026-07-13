import { memo, type CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import type { ForestExpandIconData } from '../../utils/familyForest/buildFamilyForestLayout';

function ForestExpandIconComponent({ data }: NodeProps<Node<ForestExpandIconData>>) {
  if (!data) return null;

  return (
    <button
      type="button"
      className={`family-forest-expand-icon${data.isExpanded ? ' is-expanded' : ''}`}
      style={{ '--branch-color': data.branchColor } as CSSProperties}
      aria-label={`عرض ${data.childCount} من الجيل الخامس`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="parent"
        className="family-forest-node__handle"
      />
      <span className="family-forest-expand-icon__label">+{data.childCount}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        id="children"
        className="family-forest-node__handle"
      />
    </button>
  );
}

export const ForestExpandIcon = memo(ForestExpandIconComponent);
