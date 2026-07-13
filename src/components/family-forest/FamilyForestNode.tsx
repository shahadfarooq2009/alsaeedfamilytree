import { memo, type CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import type { FamilyForestNodeData } from '../../utils/familyForest/buildFamilyForestLayout';
import { ForestInlineEditableName } from './ForestInlineEditableName';
import { useForestCardHover } from './ForestCardHoverContext';

function FamilyForestNodeComponent({ data }: NodeProps<Node<FamilyForestNodeData>>) {
  const cardHover = useForestCardHover();

  if (!data) return null;

  const photoSrc = resolveMemberPhotoUrl(data.photoUrl ?? null);
  const isExpandable = data.isGen3Grid && data.childCount > 0;

  const classes = [
    'family-forest-node',
    data.generationClass,
    `is-tier-${data.cardTier}`,
    data.isRoot ? 'is-founder' : '',
    data.isBranchHead ? 'is-branch-head' : '',
    data.isGen3Grid ? 'is-gen3-grid' : '',
    isExpandable ? 'is-expandable' : '',
    data.isHighlighted ? 'is-highlighted' : '',
    data.isSearchFocus ? 'is-search-focus' : '',
    data.isJustAdded ? 'is-just-added' : '',
  ].filter(Boolean).join(' ');

  const formatCount = (count: number) => (
    Number.isFinite(count) ? count.toLocaleString('ar-SA') : String(count)
  );

  const labelName = data.displayName?.trim() || data.fullName?.trim() || '—';

  const metaLabel = data.isRoot
    ? null
    : `أبناء: ${formatCount(data.childCount)}`;

  return (
    <div
      className={classes}
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

      <span
        className={`family-forest-node__badge${photoSrc ? ' family-forest-node__badge--photo' : ''}`}
        aria-hidden
      >
        {photoSrc ? (
          <img className="family-forest-node__badge-photo" src={photoSrc} alt="" />
        ) : (
          data.initial
        )}
      </span>

      {data.isBranchHead ? (
        <div className="family-forest-node__content">
          <ForestInlineEditableName
            memberId={data.memberId}
            fullName={data.fullName}
            displayName={labelName}
          />
          <span className="family-forest-node__children family-forest-node__branch-children">
            أبناء: {formatCount(data.childCount)}
          </span>
        </div>
      ) : (
        <>
          <ForestInlineEditableName
            memberId={data.memberId}
            fullName={data.fullName}
            displayName={labelName}
          />
          {data.isRoot ? (
            <>
              <span className="family-forest-node__children">أبناء: {formatCount(data.childCount)}</span>
              <span className="family-forest-node__role">مؤسس العائلة</span>
              {data.lifeDates ? (
                <span className="family-forest-node__dates">{data.lifeDates}</span>
              ) : null}
            </>
          ) : metaLabel ? (
            <span className="family-forest-node__children">{metaLabel}</span>
          ) : null}
        </>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="children"
        className="family-forest-node__handle"
      />
    </div>
  );
}

export const FamilyForestNode = memo(FamilyForestNodeComponent);
