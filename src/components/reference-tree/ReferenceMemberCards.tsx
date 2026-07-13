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
  focusBranchRootId: number | null,
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
    const sameBranch = focusBranchRootId == null
      || member.mainBranchRootId == null
      || member.mainBranchRootId === focusBranchRootId;

    if (inPath && member.id !== activeId) classes.push('member-focus-ancestor');
    if (isDirectChild) classes.push('member-focus-child');
    if (isSibling) classes.push('member-focus-sibling');
    if (
      (!inPath && !isDirectChild && !isSibling && member.id !== activeId)
      || !sameBranch
    ) {
      classes.push('member-focus-muted');
    }
  }
  return classes.join(' ');
}

interface ReferenceMemberCardsProps {
  members: PositionedMember[];
  layoutScale: TreeLayoutScale;
  familyName?: string | null;
  selectedId: number | null;
  hoveredId?: number | null;
  focusPathIds: number[];
  focusChildIds: number[];
  siblingIds?: number[];
  focusBranchRootId?: number | null;
  highlightIds: number[];
  interactionDisabled?: boolean;
  membersRef?: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: number) => void;
  onEditAvatar: (id: number) => void;
  onHover?: (id: number | null) => void;
}

export function ReferenceMemberCards({
  members,
  layoutScale,
  familyName = null,
  selectedId,
  hoveredId = null,
  focusPathIds,
  focusChildIds,
  siblingIds = [],
  focusBranchRootId = null,
  highlightIds,
  interactionDisabled = false,
  membersRef,
  onSelect,
  onEditAvatar,
  onHover,
}: ReferenceMemberCardsProps) {
  const activeId = selectedId ?? hoveredId;
  const founderFamilyLabel = (familyName?.replace(/^عائلة\s+/u, '').trim()
    || members.find((member) => isFounderMember(member))?.fullName.trim()
    || 'العائلة');

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
        const childCount = members.filter(
          (item) => item.fatherId === member.id || item.motherId === member.id,
        ).length;
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
              focusBranchRootId,
              layoutScale,
            )}
            data-id={member.id}
            aria-selected={isSelected}
            aria-label={tooltipText}
            title={interactionDisabled ? undefined : tooltipText}
            tabIndex={interactionDisabled ? -1 : 0}
            disabled={interactionDisabled}
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
            onPointerDown={(event) => {
              if (interactionDisabled) return;
              event.stopPropagation();
            }}
            onMouseEnter={() => {
              if (interactionDisabled) return;
              onHover?.(member.id);
            }}
            onMouseLeave={() => {
              if (interactionDisabled) return;
              onHover?.(null);
            }}
            onFocus={() => {
              if (interactionDisabled) return;
              onHover?.(member.id);
            }}
            onBlur={() => {
              if (interactionDisabled) return;
              onHover?.(null);
            }}
            onClick={() => {
              if (interactionDisabled) return;
              onSelect(member.id);
            }}
          >
            {isFounder ? (
              <>
                <span className="founder-family-name" aria-hidden>{founderFamilyLabel}</span>
                <span className="founder-role-label" aria-hidden>مؤسس العائلة</span>
              </>
            ) : null}
            <MemberAvatarBadge
              photoUrl={member.photoUrl}
              initial={member.initial}
              size={isFounder ? 'founder' : 'regular'}
              sizePx={badgeSize}
              onClick={(event) => {
                if (interactionDisabled) return;
                event.stopPropagation();
                onEditAvatar(member.id);
              }}
            />
            <span className="name">{display.label}</span>
            <span className="children-meta">أبناء: {childCount}</span>
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
