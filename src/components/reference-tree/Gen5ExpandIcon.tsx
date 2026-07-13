import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import type { Gen5IconNodeData } from '../../utils/buildFamilyTreeFlowLayout';

function Gen5ExpandIconComponent({ data }: NodeProps<Node<Gen5IconNodeData>>) {
  if (!data) return null;

  return (
    <button
      type="button"
      className={`family-tree-flow-gen5-icon${data.isExpanded ? ' is-expanded' : ''}`}
      data-parent-id={data.parentMemberId}
      aria-label={`عرض ${data.childCount} من الجيل الخامس`}
    >
      <Handle
        type="target"
        position={Position.Bottom}
        id="parent"
        className="family-tree-flow-handle"
      />
      <span className="family-tree-flow-gen5-icon__dot" aria-hidden />
      <span className="family-tree-flow-gen5-icon__label">+{data.childCount}</span>
    </button>
  );
}

export const Gen5ExpandIcon = memo(Gen5ExpandIconComponent);
