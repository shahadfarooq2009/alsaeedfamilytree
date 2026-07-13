import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import type { FamilyTreeNodeData } from '../../utils/buildFamilyTreeFlowLayout';

function FamilyTreeFlowNodeComponent({ data }: NodeProps<Node<FamilyTreeNodeData>>) {
  if (!data) return null;

  const photoSrc = resolveMemberPhotoUrl(data.photoUrl ?? null);
  const isHorizontal = data.horizontalLayout === true;

  const classes = [
    'family-tree-flow-node',
    data.generationClass,
    data.isFounder ? 'is-founder' : '',
    data.isSelected ? 'is-selected' : '',
    data.inSelectedPath ? 'is-in-path' : '',
    data.isHighlighted ? 'is-highlighted' : '',
    data.isJustAdded ? 'is-just-added' : '',
    isHorizontal ? 'is-horizontal' : '',
    data.isExpandable ? 'is-expandable' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} data-id={data.memberId}>
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        id="parent"
        className="family-tree-flow-handle"
      />
      <span
        className={`family-tree-flow-node__badge${photoSrc ? ' family-tree-flow-node__badge--photo' : ''}`}
        aria-hidden
      >
        {photoSrc ? <img src={photoSrc} alt="" /> : data.initial}
      </span>
      <span className="family-tree-flow-node__name" title={data.fullName}>
        {data.displayName}
      </span>
      <span className="family-tree-flow-node__children">
        أبناء: {data.childCount}
        {data.hiddenChildCount > 0 ? (
          <span className="family-tree-flow-node__hidden-count">
            {' '}(+{data.hiddenChildCount})
          </span>
        ) : null}
      </span>
      {data.isFounder ? (
        <span className="family-tree-flow-node__role">مؤسس العائلة</span>
      ) : null}
      <Handle
        type="source"
        position={isHorizontal ? Position.Right : Position.Bottom}
        id="children"
        className="family-tree-flow-handle"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="gen5"
        className="family-tree-flow-handle"
      />
    </div>
  );
}

export const FamilyTreeFlowNode = memo(FamilyTreeFlowNodeComponent);
