import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import type { Gen5MemberNodeData } from '../../utils/buildFamilyTreeFlowLayout';

function Gen5MemberNodeComponent({ data }: NodeProps<Node<Gen5MemberNodeData>>) {
  if (!data) return null;

  const classes = [
    'family-tree-flow-gen5-node',
    data.isEntering ? 'is-entering' : '',
    data.isExiting ? 'is-exiting' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={{ animationDelay: `${data.animationDelayMs}ms` }}
      data-id={data.memberId}
    >
      <Handle
        type="target"
        position={Position.Bottom}
        id="parent"
        className="family-tree-flow-handle"
      />
      <span className="family-tree-flow-gen5-node__name" title={data.fullName}>
        {data.displayName}
      </span>
    </div>
  );
}

export const Gen5MemberNode = memo(Gen5MemberNodeComponent);
