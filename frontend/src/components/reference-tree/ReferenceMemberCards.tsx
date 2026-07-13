import { useMemo } from 'react';
import type { PositionedMember } from '../../utils/treeLayout/types';
import {
  cardHeightForMember,
  cardWidthForMember,
  isFounderMember,
} from '../../utils/treeLayout/constants';
import { formatFatherChildRelation } from '../../utils/treeLayout/fatherRelation';
import {
  getCardDisplayText,
  type TreeLayoutScale,
} from '../../utils/treeLayout/treeLayoutScale';
import { MemberAvatarBadge } from './MemberAvatarBadge';

function cardClassName(
  member: PositionedMember,
  activeId: number | null,
  highlightIds: number[],
  focusPathIds: number[],
  focusChildIds: number[],
  siblingIds: number[],
  layoutScale: TreeLayoutScale,
): string {
  const classes = ['card', 'map-positioned', 'member-card', `tree-scale-tier-${layoutScale.tier}`];
  if (isFounderMember(member)) {
    classes.push('founder', 'founder-vip');
  } else {
    classes.push(`g${member.generation}`);
  }
  if (activeId === member.id) {
    classes.push('selected', 'is-selected', 'member-focus-selected');
  }
  if (highlightIds.includes(member.id)) {
    classes.push('search-hit');
  }
  if (activeId != null) {
    const inPath = focusPathIds.includes(member.id);
    const isDirectChild = focusChildIds.includes(member.id);
    const isSibling = siblingIds.includes(member.id);

    if (inPath && member.id !== activeId) classes.push('member-focus-ancestor');
    if (isDirectChild) classes.push('member-focus-child');
    if (isSibling) classes.push('member-focus-sibling');
    if (!inPath && !isDirectChild && !isSibling && member.id !== activeId) {
      classes.push('member-focus-muted');
    }
  }
  return classes.join(' ');
}

interface ReferenceMemberCardsProps {
  members: PositionedMember[];
  layoutScale: TreeLayoutScale;
  selectedId: number | null;
  hoveredId?: number | null;
  focusPathIds: number[];
  focusChildIds: number[];
  siblingIds?: number[];
  highlightIds: number[];
  membersRef?: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: number) => void;
  onEditAvatar: (id: number) => void;
  onHover?: (id: number | null) => void;
}

export function ReferenceMemberCards({
  members,
  layoutScale,
  selectedId,
  hoveredId = null,
  focusPathIds,
  focusChildIds,
  siblingIds = [],
  highlightIds,
  membersRef,
  onSelect,
  onEditAvatar,
  onHover,
}: ReferenceMemberCardsProps) {
  const activeId = selectedId ?? hoveredId;

  const childCountById = useMemo(() => {
    const counts = new Map<number, number>();
    members.forEach((member) => {
      if (member.fatherId == null) return;
      counts.set(member.fatherId, (counts.get(member.fatherId) ?? 0) + 1);
    });
    return counts;
  }, [members]);

  return (
    <div className="members family-tree-nodes family-tree-map-nodes" id="members" ref={membersRef}>
      {members.map((member, index) => {
        const isFounder = isFounderMember(member);
        const width = cardWidthForMember(member);
        const height = cardHeightForMember(member);
        const isFocusActive = activeId != null;
        const inPath = focusPathIds.includes(member.id);
        const isDirectChild = focusChildIds.includes(member.id);
        const isSibling = siblingIds.includes(member.id);
        const isMuted = isFocusActive && !inPath && !isDirectChild && !isSibling && member.id !== activeId;
        const isRelated = isFocusActive && (inPath || isDirectChild || isSibling) && member.id !== activeId;
        const isSelected = selectedId === member.id;
        const isHovered = hoveredId === member.id;
        const display = getCardDisplayText(member, layoutScale, members);
        const fatherRelation = formatFatherChildRelation(member, members);
        const badgeSize = isFounder ? layoutScale.founderBadgeSize : layoutScale.badgeSize;
        const nameFontSize = isFounder ? layoutScale.founderNameFontSize : layoutScale.nameFontSize;
        const borderRadius = isFounder ? layoutScale.founderBorderRadius : layoutScale.borderRadius;
        const paddingTop = isFounder ? layoutScale.founderPaddingTop : layoutScale.cardPaddingTop;
        const tooltipText = fatherRelation
          ? `${member.fullName}\n${fatherRelation}`
          : member.fullName;

        return (
          <button
            key={member.id}
            type="button"
            className={cardClassName(
              member,
              activeId,
              highlightIds,
              focusPathIds,
              focusChildIds,
              siblingIds,
              layoutScale,
            )}
            data-id={member.id}
            aria-selected={isSelected}
            aria-label={tooltipText}
            title={tooltipText}
            style={{
              left: `${member.x}px`,
              top: `${member.y}px`,
              width: `${width}px`,
              minWidth: `${width}px`,
              maxWidth: `${width}px`,
              height: `${height}px`,
              minHeight: `${height}px`,
              maxHeight: `${height}px`,
              borderRadius: `${borderRadius}px`,
              paddingTop: `${paddingTop}px`,
              ['--tree-name-font' as string]: `${nameFontSize}px`,
              ['--tree-badge-size' as string]: `${badgeSize}px`,
              ['--focus-stagger' as string]: isMuted
                ? `${Math.min(index * 18, 160)}ms`
                : isRelated
                  ? `${Math.min(index * 10, 80)}ms`
                  : '0ms',
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseEnter={() => onHover?.(member.id)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(member.id)}
            onBlur={() => onHover?.(null)}
            onClick={() => onSelect(member.id)}
          >
            {isFounder ? <span className="founder-vip-crown" aria-hidden>★</span> : null}
            <MemberAvatarBadge
              photoUrl={member.photoUrl}
              initial={member.initial}
              size={isFounder ? 'founder' : 'regular'}
              sizePx={badgeSize}
              onClick={(event) => {
                event.stopPropagation();
                onEditAvatar(member.id);
              }}
            />
            <span className="name">{display.label}</span>
            <span className="children-meta">
              {childCountById.get(member.id) ?? 0} أبناء
            </span>
            {display.showRelation && display.relationLabel && layoutScale.tier <= 2 ? (
              <span className="relation">{display.relationLabel}</span>
            ) : null}
            {isHovered && fatherRelation ? (
              <span className="member-relation-tooltip" role="tooltip">
                <strong>{member.fullName}</strong>
                <em>{fatherRelation}</em>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
