import { memo, type CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import type { ForestInlineMemberData } from '../../utils/familyForest/buildFamilyForestLayout';
import { useForestCardHover } from './ForestCardHoverContext';

function ForestInlineMemberComponent({ data }: NodeProps<Node<ForestInlineMemberData>>) {
  const cardHover = useForestCardHover();

  if (!data) return null;

  return (
    <div
      className={`family-forest-node is-tier-micro ${data.generationClass}${data.isHighlighted ? ' is-highlighted' : ''}${data.isSearchFocus ? ' is-search-focus' : ''}${data.isJustAdded ? ' is-just-added' : ''}`}
      style={data.generationStyle as CSSProperties}
      data-id={data.memberId}
      data-forest-card=""
      onMouseEnter={() => cardHover?.onCardEnter(data.memberId)}
      onMouseLeave={() => cardHover?.onCardLeave()}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="parent"
        className="family-forest-node__handle"
      />

      <span className="family-forest-node__badge" aria-hidden>
        {data.initial}
      </span>

      <span className="family-forest-node__name" title={data.fullName}>
        {data.displayName}
      </span>

      <span className="family-forest-node__children">أبناء: {data.childCount}</span>

      <Handle
        type="source"
        position={Position.Bottom}
        id="children"
        className="family-forest-node__handle"
      />
    </div>
  );
}

export const ForestInlineMember = memo(ForestInlineMemberComponent);
