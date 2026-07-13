import { useCallback, useMemo, useState, type CSSProperties } from 'react';

import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import {
  BRANCH_BOARD_MAX_CHILD_CHIPS,
  buildBranchBoardBreadcrumb,
  buildBranchFamilyBoardGroups,
  getBranchBoardDirectChildren,
  getBranchBoardHighlightIds,
} from '../../utils/familyForest/buildBranchFamilyBoard';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { getGenerationThemeClass, getGenerationThemeStyle } from '../../utils/generationTheme';
import { BranchFamilyMemberPanel } from './BranchFamilyMemberPanel';

interface BranchFamilyBoardProps {
  members: FamilyMemberInput[];
  branchHeadId: number;
  branchName: string;
  branchIndex: number;
  branchColor: string;
  familyId?: number;
  onBackToMain: () => void;
  onEditMember?: (memberId: number) => void;
}

function ForestBoardMemberCard({
  member,
  tier,
  metaLabel,
  isSelected,
  isHighlighted,
  onClick,
}: {
  member: FamilyMemberInput;
  tier: 'standard' | 'gen3-grid';
  metaLabel: string;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const displayName = getMemberFirstName(member.fullName);
  const photoSrc = resolveMemberPhotoUrl(member.photoUrl ?? null);
  const generationClass = getGenerationThemeClass(member.generation);
  const generationStyle = getGenerationThemeStyle(member.generation);

  const tierClass = tier === 'gen3-grid'
    ? 'is-tier-micro is-gen3-grid'
    : 'is-tier-standard';

  return (
    <button
      type="button"
      className={[
        'family-forest-node',
        'branch-family-board__node',
        tierClass,
        generationClass,
        isSelected ? 'is-selected' : '',
        isHighlighted ? 'is-highlighted' : '',
      ].filter(Boolean).join(' ')}
      style={generationStyle as CSSProperties}
      onClick={onClick}
      data-id={member.id}
    >
      <span
        className={[
          'family-forest-node__badge',
          photoSrc ? 'family-forest-node__badge--photo' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden
      >
        {photoSrc ? (
          <img className="family-forest-node__badge-photo" src={photoSrc} alt="" />
        ) : (
          member.initial || displayName.charAt(0)
        )}
      </span>
      <span className="family-forest-node__name" title={member.fullName}>
        {displayName}
      </span>
      <span className="family-forest-node__children">{metaLabel}</span>
    </button>
  );
}

export function BranchFamilyBoard({
  members,
  branchHeadId,
  branchName,
  branchIndex,
  branchColor,
  familyId,
  onBackToMain,
  onEditMember,
}: BranchFamilyBoardProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [sidePanelMemberId, setSidePanelMemberId] = useState<number | null>(null);
  const [expandedInlineIds, setExpandedInlineIds] = useState<Set<number>>(() => new Set());

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const groups = useMemo(
    () => buildBranchFamilyBoardGroups(members, branchHeadId, BRANCH_BOARD_MAX_CHILD_CHIPS, familyId),
    [branchHeadId, familyId, members],
  );

  const highlightIds = useMemo(
    () => getBranchBoardHighlightIds(members, branchHeadId, selectedMemberId, familyId),
    [branchHeadId, familyId, members, selectedMemberId],
  );

  const breadcrumbs = useMemo(
    () => buildBranchBoardBreadcrumb(
      members,
      branchHeadId,
      branchName,
      selectedMemberId,
      familyId,
    ),
    [branchHeadId, branchName, familyId, members, selectedMemberId],
  );

  const sidePanelMember = sidePanelMemberId != null
    ? memberById.get(sidePanelMemberId) ?? null
    : null;

  const handleBreadcrumbClick = useCallback((memberId: number | null) => {
    if (memberId == null) {
      onBackToMain();
      return;
    }
    setSelectedMemberId(memberId === branchHeadId ? null : memberId);
    setSidePanelMemberId(null);
  }, [branchHeadId, onBackToMain]);

  const handleSelectHead = useCallback((memberId: number) => {
    setSelectedMemberId((current) => (current === memberId ? null : memberId));
    setSidePanelMemberId(null);
  }, []);

  const handleSelectBrownCard = useCallback((memberId: number) => {
    setSelectedMemberId(memberId);
    setSidePanelMemberId(memberId);
  }, []);

  const handleCloseSidePanel = useCallback(() => {
    setSidePanelMemberId(null);
    setSelectedMemberId(null);
  }, []);

  const handleShowInlineFamily = useCallback((memberId: number) => {
    setExpandedInlineIds((current) => {
      const next = new Set(current);
      next.add(memberId);
      return next;
    });
  }, []);

  const handleHideInlineFamily = useCallback((memberId: number) => {
    setExpandedInlineIds((current) => {
      const next = new Set(current);
      next.delete(memberId);
      return next;
    });
  }, []);

  const renderInlineChildren = useCallback((parentId: number) => {
    const directChildren = getBranchBoardDirectChildren(members, branchHeadId, parentId, familyId);
    if (directChildren.length === 0) return null;

    return (
      <div className="branch-family-group__inline-block">
        <div className="branch-family-group__inline-grid">
          {directChildren.map((child) => {
            const childCount = getBranchBoardDirectChildren(members, branchHeadId, child.id, familyId).length;
            return (
              <ForestBoardMemberCard
                key={child.id}
                member={child}
                tier="gen3-grid"
                metaLabel={`أبناء: ${childCount}`}
                isSelected={selectedMemberId === child.id}
                isHighlighted={highlightIds.has(child.id)}
                onClick={() => handleSelectBrownCard(child.id)}
              />
            );
          })}
        </div>
        <button
          type="button"
          className="branch-family-group__inline-hide"
          onClick={() => handleHideInlineFamily(parentId)}
        >
          إخفاء الأبناء
        </button>
      </div>
    );
  }, [
    branchHeadId,
    handleHideInlineFamily,
    handleSelectBrownCard,
    highlightIds,
    members,
    selectedMemberId,
  ]);

  if (groups.length === 0) {
    return (
      <div className="branch-family-board branch-family-board--empty">
        <p>لا توجد مجموعات عائلية في هذا الفرع.</p>
      </div>
    );
  }

  return (
    <div
      className={[
        'branch-family-board',
        sidePanelMember ? 'has-side-panel' : '',
      ].filter(Boolean).join(' ')}
      style={{ ['--branch-accent' as string]: branchColor }}
    >
      <div className="branch-family-board__main">
        <div className="branch-family-board__toolbar">
          <button
            type="button"
            className="branch-expand-panel__back"
            onClick={onBackToMain}
          >
            الرجوع للفروع الرئيسية
          </button>

          <nav className="branch-family-board__breadcrumb" aria-label="مسار التصفح">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.id ?? 'root'}-${index}`} className="branch-family-board__crumb-wrap">
                {index > 0 ? (
                  <span className="branch-family-board__crumb-sep" aria-hidden> &gt; </span>
                ) : null}
                {isLast ? (
                  <span className="branch-family-board__crumb is-current">{crumb.label}</span>
                ) : (
                  <button
                    type="button"
                    className="branch-family-board__crumb"
                    onClick={() => handleBreadcrumbClick(crumb.id)}
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            );
          })}
          </nav>
        </div>

        <div className="branch-family-board__grid">
          {groups.map((group) => {
            const isGroupSelected = selectedMemberId === group.head.id;
            const isGroupHighlighted = highlightIds.has(group.head.id)
              || group.children.some((chip) => highlightIds.has(chip.member.id));

            return (
              <section
                key={group.head.id}
                className={[
                  'branch-family-group',
                  isGroupHighlighted ? 'is-highlighted' : '',
                ].filter(Boolean).join(' ')}
                style={{ ['--branch-color' as string]: branchColor } as CSSProperties}
              >
                <div
                  className={[
                    'family-forest-branch-panel',
                    'branch-family-group__panel',
                    `is-panel-${branchIndex % 4}`,
                  ].join(' ')}
                  style={{ ['--branch-color' as string]: branchColor } as CSSProperties}
                >
                  <div className="branch-family-group__inner">
                    <ForestBoardMemberCard
                      member={group.head}
                      tier="standard"
                      metaLabel={`أبناء: ${group.directChildCount}`}
                      isSelected={isGroupSelected}
                      isHighlighted={highlightIds.has(group.head.id)}
                      onClick={() => handleSelectHead(group.head.id)}
                    />

                    {group.children.length > 0 ? (
                      <div className="branch-family-group__children-grid">
                        {group.children.map((chip) => {
                          const isExpanded = expandedInlineIds.has(chip.member.id);
                          return (
                            <div
                              key={chip.member.id}
                              className={[
                                'branch-family-group__child-wrap',
                                isExpanded ? 'has-inline' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <ForestBoardMemberCard
                                member={chip.member}
                                tier="gen3-grid"
                                metaLabel={`أبناء: ${chip.directChildCount}`}
                                isSelected={selectedMemberId === chip.member.id}
                                isHighlighted={highlightIds.has(chip.member.id)}
                                onClick={() => handleSelectBrownCard(chip.member.id)}
                              />
                              {isExpanded ? renderInlineChildren(chip.member.id) : null}
                            </div>
                          );
                        })}
                        {group.directChildCount > group.children.length ? (
                          <div className="branch-family-group__more-slot" aria-hidden>
                            <span className="family-forest-expand-icon branch-family-group__more-icon">
                              <span className="family-forest-expand-icon__label">
                                +{group.directChildCount - group.children.length}
                              </span>
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="branch-family-group__empty">لا يوجد أبناء مسجلون</p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {sidePanelMember ? (
        <BranchFamilyMemberPanel
          member={sidePanelMember}
          members={members}
          branchHeadId={branchHeadId}
          isInlineExpanded={expandedInlineIds.has(sidePanelMember.id)}
          onClose={handleCloseSidePanel}
          onShowFamily={() => handleShowInlineFamily(sidePanelMember.id)}
          onHideFamily={() => handleHideInlineFamily(sidePanelMember.id)}
          onEditMember={onEditMember}
        />
      ) : null}
    </div>
  );
}
