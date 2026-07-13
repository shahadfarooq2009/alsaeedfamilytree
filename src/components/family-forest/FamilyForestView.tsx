import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type OnMove,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../../features/family-tree/theme/referenceTree.css';

import type { PersonSummary } from '../../types/person';
import { deletePerson } from '../../services/personService';
import { getAuthUser } from '../../services/authService';
import { toApiError } from '../../lib/api';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { unregisterMarriageForPerson } from '../../utils/marriageRegistry';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { findMemberIdsByNameQuery } from '../../utils/familyTreeSearch';
import { ADDED_MEMBER_GLOW_MS } from '../../utils/animateAddedMember';
import {
  buildFamilyForestLayout,
  type FamilyForestNodeData,
  type ForestFlowNodeData,
} from '../../utils/familyForest/buildFamilyForestLayout';
import { countGen2Branches } from '../../utils/familyForest/forestColumnLayout';
import { getForestLayoutWidth, getForestMapCenterX, resolveForestColumnCount } from '../../utils/familyForest/forestViewport';
import { computeForestHoverAnchor } from '../../utils/familyForest/forestHoverAnchor';
import {
  computeForestMemberFocusViewport,
  findForestMemberNode,
  FOREST_SEARCH_FOCUS_ZOOM,
  getForestNodeMemberId,
  getGen5ParentIdForMember,
} from '../../utils/familyForest/focusForestMember';
import type { MemberPanelAnchor } from '../../utils/computeMemberPanelAnchor';
import { FamilyForestNode } from './FamilyForestNode';
import { ForestBranchPanel } from './ForestBranchPanel';
import { ForestExpandIcon } from './ForestExpandIcon';
import { ForestBranchPanelOverlays } from './ForestBranchPanelOverlays';
import { ForestFooter } from './ForestFooter';
import { ForestFounderRail } from './ForestFounderRail';
import { ForestInlineMember } from './ForestInlineMember';
import { ForestLocalEdge } from './ForestLocalEdge';
import { ForestPageHeader } from './ForestPageHeader';
import { ForestMemberHoverCard } from './ForestMemberHoverCard';
import { ForestCardHoverContext } from './ForestCardHoverContext';
import { BranchExpandedView, type BranchExpandState } from './BranchExpandedView';
import { AddMemberModal } from '../reference-tree/AddMemberModal';
import { EditMemberModal } from '../reference-tree/EditMemberModal';
import { PrintFamilyTreeModal } from '../reference-tree/PrintFamilyTreeModal';
import { ShareFamilyTreeModal } from '../reference-tree/ShareFamilyTreeModal';
import { TreeBackgroundPicker } from '../reference-tree/TreeBackgroundPicker';
import type { FamilyTreeFlowHandle } from '../reference-tree/FamilyTreeFlow';
import {
  loadTreeBackgroundSettings,
  saveTreeBackgroundSettings,
  type TreeBackgroundSettings,
} from '../../utils/treeBackgroundStorage';
import { prepareBranchSubtreeForFlow } from '../../utils/familyForest/getBranchSubtreeMembers';
import { canManageFamilyTree } from '../../utils/treeAdmin';
import { syncMarriagesFromPeople } from '../../utils/spousePerson';
import './FamilyForest.css';

const nodeTypes = {
  familyForest: FamilyForestNode,
  forestExpandIcon: ForestExpandIcon,
  forestInlineMember: ForestInlineMember,
  forestBranchPanel: ForestBranchPanel,
  forestFounderRail: ForestFounderRail,
};

const edgeTypes = {
  forestLocal: ForestLocalEdge,
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.35;
const DEFAULT_ZOOM = 0.92;
const HEADER_CLEARANCE = 88;
const FOOTER_CLEARANCE = 100;
const HOVER_SHOW_DELAY_MS = 140;
const HOVER_HIDE_DELAY_MS = 120;

function useScreenSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

interface FamilyForestCanvasProps {
  members: FamilyMemberInput[];
  people?: PersonSummary[];
  familyName?: string | null;
  familyId: number;
  editable: boolean;
  screenWidth: number;
  screenHeight: number;
  selectedMemberId: number | null;
  highlightIds: number[];
  searchFocusMemberId: number | null;
  justAddedMemberId: number | null;
  onClearSearchFocus?: () => void;
  onFocusMember?: (memberId: number) => void;
  onMemberSelect?: (memberId: number | null) => void;
  onSelectMember: (memberId: number | null) => void;
  onMemberUpdated?: () => Promise<void> | void;
  onOpenEditMember?: (memberId: number) => void;
  onDeleteMember?: (memberId: number) => void;
  onShare?: () => void;
  onPrint?: () => void;
  onToast?: (message: string) => void;
}

function FamilyForestCanvas({
  members,
  people = [],
  familyName,
  familyId,
  editable,
  screenWidth,
  screenHeight,
  selectedMemberId,
  highlightIds,
  searchFocusMemberId,
  justAddedMemberId,
  onClearSearchFocus,
  onFocusMember,
  onMemberSelect,
  onSelectMember,
  onMemberUpdated,
  onOpenEditMember,
  onDeleteMember,
  onShare,
  onPrint,
  onToast,
}: FamilyForestCanvasProps) {
  const { setViewport } = useReactFlow();
  const layoutWidth = useMemo(() => {
    const columnCount = resolveForestColumnCount(screenWidth, countGen2Branches(members));
    return getForestLayoutWidth(screenWidth, columnCount);
  }, [members, screenWidth]);
  const [expandedGen5ParentIds, setExpandedGen5ParentIds] = useState<Set<number>>(
    () => new Set(),
  );

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const hoverPanelRef = useRef<HTMLElement>(null);
  const searchFocusPanelRef = useRef<HTMLElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const showHoverTimerRef = useRef<number | null>(null);
  const hideHoverTimerRef = useRef<number | null>(null);
  const [hoveredMemberId, setHoveredMemberId] = useState<number | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const [hoverAnchor, setHoverAnchor] = useState<MemberPanelAnchor | null>(null);
  const [searchFocusAnchor, setSearchFocusAnchor] = useState<MemberPanelAnchor | null>(null);
  const [branchExpand, setBranchExpand] = useState<BranchExpandState | null>(null);

  const clearHoverTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateHoverAnchor = useCallback(() => {
    if (hoveredMemberId == null) {
      setHoverAnchor(null);
      return;
    }

    const card = mapWrapRef.current?.querySelector<HTMLElement>(
      `[data-forest-card][data-id="${hoveredMemberId}"]`,
    );
    if (!card) return;

    setHoverAnchor(computeForestHoverAnchor(card, hoverPanelRef.current));
  }, [hoveredMemberId]);

  const updateSearchFocusAnchor = useCallback(() => {
    if (searchFocusMemberId == null) {
      setSearchFocusAnchor(null);
      return;
    }

    const card = mapWrapRef.current?.querySelector<HTMLElement>(
      `[data-forest-card][data-id="${searchFocusMemberId}"]`,
    );
    if (!card) return;

    setSearchFocusAnchor(computeForestHoverAnchor(card, searchFocusPanelRef.current));
  }, [searchFocusMemberId]);

  const layout = useMemo(
    () => buildFamilyForestLayout(members, {
      viewportWidth: layoutWidth,
      screenWidth,
      peopleById,
      expandedGen5ParentIds,
      selectedMemberId,
    }),
    [expandedGen5ParentIds, layoutWidth, members, peopleById, screenWidth, selectedMemberId],
  );

  const mapCenterX = useMemo(
    () => getForestMapCenterX(layout.width, DEFAULT_ZOOM),
    [layout.width],
  );

  const initialViewport = useMemo(() => {
    const availableHeight = Math.max(320, screenHeight - HEADER_CLEARANCE - FOOTER_CLEARANCE);
    const contentHeight = layout.height * DEFAULT_ZOOM;
    const y = contentHeight < availableHeight
      ? Math.max(0, (availableHeight - contentHeight) / 2)
      : 0;

    return { x: mapCenterX, y, zoom: DEFAULT_ZOOM };
  }, [layout.height, mapCenterX, screenHeight]);

  const lockedViewportY = initialViewport.y;
  const searchFocusActive = searchFocusMemberId != null;

  useLayoutEffect(() => {
    if (searchFocusMemberId == null) return undefined;
    updateSearchFocusAnchor();
    const frame = window.requestAnimationFrame(updateSearchFocusAnchor);
    window.addEventListener('resize', updateSearchFocusAnchor);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateSearchFocusAnchor);
    };
  }, [searchFocusMemberId, updateSearchFocusAnchor, layout.width, mapCenterX, lockedViewportY]);

  useEffect(() => {
    if (searchFocusMemberId == null) return undefined;

    const gen5ParentId = getGen5ParentIdForMember(searchFocusMemberId, members);
    if (gen5ParentId != null && !expandedGen5ParentIds.has(gen5ParentId)) {
      setExpandedGen5ParentIds((current) => new Set(current).add(gen5ParentId));
      return undefined;
    }

    const memberNode = findForestMemberNode(layout.nodes, searchFocusMemberId);
    if (!memberNode) return undefined;

    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
    setHoverVisible(false);
    setHoveredMemberId(null);
    setHoverAnchor(null);

    const availableHeight = Math.max(320, screenHeight - HEADER_CLEARANCE - FOOTER_CLEARANCE);
    const targetViewport = computeForestMemberFocusViewport(
      memberNode,
      FOREST_SEARCH_FOCUS_ZOOM,
      layout.width,
      availableHeight,
    );

    setViewport(targetViewport, { duration: 420 });

    const frame = window.requestAnimationFrame(updateSearchFocusAnchor);
    return () => window.cancelAnimationFrame(frame);
  }, [
    clearHoverTimer,
    expandedGen5ParentIds,
    layout.nodes,
    layout.width,
    members,
    screenHeight,
    searchFocusMemberId,
    setViewport,
    updateSearchFocusAnchor,
  ]);

  useLayoutEffect(() => {
    if (!hoverVisible || hoveredMemberId == null) return undefined;
    updateHoverAnchor();
    const frame = window.requestAnimationFrame(updateHoverAnchor);
    window.addEventListener('resize', updateHoverAnchor);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateHoverAnchor);
    };
  }, [hoverVisible, hoveredMemberId, updateHoverAnchor, layout.width, mapCenterX, lockedViewportY]);

  useEffect(() => () => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
  }, [clearHoverTimer]);

  const scheduleShowHover = useCallback((memberId: number) => {
    clearHoverTimer(hideHoverTimerRef);
    clearHoverTimer(showHoverTimerRef);

    showHoverTimerRef.current = window.setTimeout(() => {
      setHoveredMemberId(memberId);
      setHoverVisible(true);
    }, HOVER_SHOW_DELAY_MS);
  }, [clearHoverTimer]);

  const scheduleHideHover = useCallback(() => {
    clearHoverTimer(hideHoverTimerRef);
    hideHoverTimerRef.current = window.setTimeout(() => {
      setHoverVisible(false);
      setHoveredMemberId(null);
      setHoverAnchor(null);
    }, HOVER_HIDE_DELAY_MS);
  }, [clearHoverTimer]);

  const onNodeMouseEnter = useCallback((_event: MouseEvent, node: Node<ForestFlowNodeData>) => {
    if (searchFocusMemberId != null) return;
    if (node.type !== 'familyForest' && node.type !== 'forestInlineMember') return;

    const data = node.data as FamilyForestNodeData | { memberId: number; branchColor?: string };
    scheduleShowHover(data.memberId);
  }, [scheduleShowHover, searchFocusMemberId]);

  const onNodeMouseLeave = useCallback((_event: MouseEvent, node: Node<ForestFlowNodeData>) => {
    if (node.type !== 'familyForest' && node.type !== 'forestInlineMember') return;
    clearHoverTimer(showHoverTimerRef);
    scheduleHideHover();
  }, [clearHoverTimer, scheduleHideHover]);

  const cardHoverHandlers = useMemo(() => ({
    onCardEnter: scheduleShowHover,
    onCardLeave: () => {
      clearHoverTimer(showHoverTimerRef);
      scheduleHideHover();
    },
    editable,
    familyId,
    onMemberUpdated,
    onToast,
    onOpenMemberPanel: onFocusMember,
  }), [
    clearHoverTimer,
    editable,
    familyId,
    onFocusMember,
    onMemberUpdated,
    onToast,
    scheduleHideHover,
    scheduleShowHover,
  ]);

  const onHoverCardEnter = useCallback(() => {
    clearHoverTimer(hideHoverTimerRef);
  }, [clearHoverTimer]);

  const onHoverCardLeave = useCallback(() => {
    scheduleHideHover();
  }, [scheduleHideHover]);

  const handleEditFromHover = useCallback((memberId: number) => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
    setHoverVisible(false);
    setHoveredMemberId(null);
    setHoverAnchor(null);
    onOpenEditMember?.(memberId);
  }, [clearHoverTimer, onOpenEditMember]);

  const hoveredMember = hoveredMemberId != null ? membersById.get(hoveredMemberId) : null;
  const hoveredPerson = hoveredMemberId != null ? peopleById.get(hoveredMemberId) : null;
  const searchFocusMember = searchFocusMemberId != null
    ? membersById.get(searchFocusMemberId) ?? null
    : null;
  const searchFocusPerson = searchFocusMemberId != null
    ? peopleById.get(searchFocusMemberId) ?? null
    : null;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ForestFlowNodeData>>([]);

  useEffect(() => {
    setNodes(layout.nodes.map((node) => {
      const memberId = getForestNodeMemberId(node);
      const isHighlighted = memberId != null && highlightIds.includes(memberId);
      const isSearchFocus = searchFocusMemberId != null && memberId === searchFocusMemberId;
      const isJustAdded = justAddedMemberId != null && memberId === justAddedMemberId;

      return {
        ...node,
        selected: selectedMemberId != null && node.id === String(selectedMemberId),
        data: memberId != null && node.data
          ? {
            ...node.data,
            isHighlighted,
            isSearchFocus,
            isJustAdded,
          }
          : node.data,
      };
    }));
  }, [highlightIds, justAddedMemberId, layout.nodes, searchFocusMemberId, selectedMemberId, setNodes]);

  useEffect(() => {
    if (searchFocusActive) return;
    setViewport(initialViewport, { duration: 0 });
  }, [initialViewport, layout.width, searchFocusActive, setViewport]);

  const onMove: OnMove = useCallback((_event, viewport) => {
    if (!searchFocusActive) {
      if (
        Math.abs(viewport.x - mapCenterX) > 1
        || Math.abs(viewport.y - lockedViewportY) > 1
      ) {
        setViewport({
          x: mapCenterX,
          y: lockedViewportY,
          zoom: viewport.zoom,
        }, { duration: 0 });
      }
    } else {
      window.requestAnimationFrame(updateSearchFocusAnchor);
    }

    if (hoverVisible && hoveredMemberId != null) {
      window.requestAnimationFrame(updateHoverAnchor);
    }
  }, [
    hoverVisible,
    hoveredMemberId,
    lockedViewportY,
    mapCenterX,
    searchFocusActive,
    setViewport,
    updateHoverAnchor,
    updateSearchFocusAnchor,
  ]);

  const toggleGen5 = useCallback((parentId: number) => {
    setExpandedGen5ParentIds((current) => {
      const next = new Set(current);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const openBranchFamilyModal = useCallback((
    data: FamilyForestNodeData,
    useFamilyBoard = data.isBranchHead,
  ) => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
    setHoverVisible(false);
    setHoveredMemberId(null);
    setHoverAnchor(null);

    const card = document.querySelector<HTMLElement>(`[data-id="${data.memberId}"]`);
    const rect = card?.getBoundingClientRect();
    if (!rect) return;

    const branchMembers = prepareBranchSubtreeForFlow(members, data.memberId, familyId);
    if (branchMembers.length === 0) {
      onToast?.('تعذّر تحميل خريطة عائلة هذا الفرد');
      return;
    }

    setBranchExpand({
      branchHeadId: data.memberId,
      branchName: data.displayName || data.fullName,
      branchIndex: data.branchIndex,
      memberCount: branchMembers.length,
      useFamilyBoard,
      showMapActions: !useFamilyBoard && Boolean(data.isGen3Grid),
      anchor: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
    onSelectMember(data.memberId);
    onMemberSelect?.(data.memberId);
  }, [clearHoverTimer, familyId, members, onMemberSelect, onSelectMember, onToast]);

  const onNodeClick = useCallback((_event: MouseEvent, node: Node<ForestFlowNodeData>) => {
    if (node.type === 'forestBranchPanel' || node.type === 'forestFounderRail') return;

    if (node.type === 'forestExpandIcon') {
      const parentId = (node.data as { parentMemberId: number }).parentMemberId;
      toggleGen5(parentId);
      return;
    }

    if (node.type === 'familyForest') {
      const data = node.data as FamilyForestNodeData;
      if (data.isBranchHead) {
        openBranchFamilyModal(data);
        return;
      }
      if (data.isGen3Grid) {
        openBranchFamilyModal(data, false);
        return;
      }
    }

    const memberId = (node.data as FamilyForestNodeData | { memberId: number }).memberId;
    if (editable && onFocusMember && memberId != null) {
      onFocusMember(memberId);
      return;
    }
    onSelectMember(memberId);
    onMemberSelect?.(memberId ?? null);
  }, [editable, onFocusMember, onMemberSelect, onSelectMember, openBranchFamilyModal, toggleGen5]);

  const clearSearchFocus = useCallback(() => {
    onClearSearchFocus?.();
    setSearchFocusAnchor(null);
    setViewport(initialViewport, { duration: 280 });
  }, [initialViewport, onClearSearchFocus, setViewport]);

  const onPaneClick = useCallback(() => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
    setHoverVisible(false);
    setHoveredMemberId(null);
    setHoverAnchor(null);
    if (searchFocusActive) {
      clearSearchFocus();
      return;
    }
    onSelectMember(null);
    onMemberSelect?.(null);
  }, [
    clearHoverTimer,
    clearSearchFocus,
    onMemberSelect,
    onSelectMember,
    searchFocusActive,
  ]);

  const panelNodes = useMemo(
    () => layout.nodes.filter((node) => node.type === 'forestBranchPanel'),
    [layout.nodes],
  );

  const flowNodes = useMemo(
    () => nodes.filter((node) => node.type !== 'forestBranchPanel'),
    [nodes],
  );

  return (
    <ForestCardHoverContext.Provider value={cardHoverHandlers}>
      <div ref={mapWrapRef} className="family-forest__map-wrap" style={{ width: layoutWidth }}>
        <div
          className="family-forest__stage"
          style={{ width: layout.width, height: layout.height }}
        >
          <ForestBranchPanelOverlays panels={panelNodes} />
          <ReactFlow
          nodes={flowNodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={onPaneClick}
          onMove={onMove}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={initialViewport}
          translateExtent={[
            [0, 0],
            [layout.width, layout.height],
          ]}
          nodeExtent={[
            [0, 0],
            [layout.width, layout.height],
          ]}
          fitView={false}
          onlyRenderVisibleElements
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          proOptions={{ hideAttribution: true }}
          className="family-forest__canvas"
          style={{ width: layout.width, height: layout.height }}
        />
        </div>
        <ForestFooter
          memberCount={members.length}
          familyName={familyName}
          members={members}
          people={people}
          mapCenterX={mapCenterX}
          onShare={onShare}
          onPrint={onPrint}
          onToast={onToast}
        />

        {hoveredMember && typeof document !== 'undefined' && !searchFocusActive
          ? createPortal(
            <ForestMemberHoverCard
              ref={hoverPanelRef}
              member={hoveredMember}
              members={members}
              person={hoveredPerson}
              familyId={familyId}
              anchor={hoverAnchor}
              visible={hoverVisible && branchExpand == null}
              editable={editable}
              onEditRequest={handleEditFromHover}
              onDeleteRequest={onDeleteMember}
              onPointerEnter={onHoverCardEnter}
              onPointerLeave={onHoverCardLeave}
            />,
            document.body,
          )
          : null}

        {searchFocusMember && typeof document !== 'undefined'
          ? createPortal(
            <ForestMemberHoverCard
              ref={searchFocusPanelRef}
              member={searchFocusMember}
              members={members}
              person={searchFocusPerson}
              familyId={familyId}
              anchor={searchFocusAnchor}
              visible={branchExpand == null}
              pinned
              editable={editable}
              onEditRequest={handleEditFromHover}
              onDeleteRequest={onDeleteMember}
              onClose={clearSearchFocus}
            />,
            document.body,
          )
          : null}

        <BranchExpandedView
          branch={branchExpand}
          members={members}
          people={people}
          familyId={familyId}
          editable={editable}
          onEditRequest={onOpenEditMember}
          onDeleteRequest={onDeleteMember}
          onToast={onToast}
          onClose={() => setBranchExpand(null)}
        />
      </div>
    </ForestCardHoverContext.Provider>
  );
}

export interface FamilyForestViewProps {
  familyName?: string | null;
  familyId: number;
  founderPersonId?: number | null;
  members: FamilyMemberInput[];
  people?: PersonSummary[];
  onTreeRefresh?: () => Promise<void> | void;
  onAddMember?: () => void;
  onBackToTree?: () => void;
  onMemberSelect?: (memberId: number | null) => void;
}

export function FamilyForestView({
  familyName,
  familyId,
  founderPersonId = null,
  members,
  people,
  onTreeRefresh,
  onAddMember,
  onMemberSelect,
}: FamilyForestViewProps) {
  const screenSize = useScreenSize();
  const forestExportRef = useRef<HTMLDivElement>(null);
  const flowHandleRef = useRef<FamilyTreeFlowHandle | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [searchFocusMemberId, setSearchFocusMemberId] = useState<number | null>(null);
  const [justAddedMemberId, setJustAddedMemberId] = useState<number | null>(null);
  const addedMemberGlowTimerRef = useRef<number | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [backgroundSettings, setBackgroundSettings] = useState<TreeBackgroundSettings>(() =>
    loadTreeBackgroundSettings(familyId),
  );

  useEffect(() => {
    setBackgroundSettings(loadTreeBackgroundSettings(familyId));
  }, [familyId]);

  useEffect(() => {
    saveTreeBackgroundSettings(familyId, backgroundSettings);
  }, [backgroundSettings, familyId]);

  useEffect(() => {
    if (!people?.length) return;
    syncMarriagesFromPeople(familyId, people, members);
  }, [familyId, members, people]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2800);
  }, []);

  const canManageMembers = Boolean(onTreeRefresh) && canManageFamilyTree(getAuthUser());

  const handleOpenAddMember = useCallback(() => {
    if (!canManageMembers) return;
    if (onTreeRefresh) {
      setAddMemberOpen(true);
      return;
    }
    onAddMember?.();
  }, [canManageMembers, onAddMember, onTreeRefresh]);

  const hasFounder = founderPersonId != null
    || members.some((member) => member.isFamilyHead);

  const handleMemberAdded = useCallback(async (personId: number) => {
    if (onTreeRefresh) {
      await onTreeRefresh();
    }

    if (addedMemberGlowTimerRef.current != null) {
      window.clearTimeout(addedMemberGlowTimerRef.current);
    }

    setHighlightIds([personId]);
    setJustAddedMemberId(personId);
    onMemberSelect?.(personId);

    addedMemberGlowTimerRef.current = window.setTimeout(() => {
      setJustAddedMemberId(null);
      setHighlightIds([]);
      addedMemberGlowTimerRef.current = null;
    }, ADDED_MEMBER_GLOW_MS);

    showToast('تمت إضافة الفرد بنجاح');
  }, [onMemberSelect, onTreeRefresh, showToast]);

  useEffect(() => () => {
    if (addedMemberGlowTimerRef.current != null) {
      window.clearTimeout(addedMemberGlowTimerRef.current);
    }
  }, []);

  const handleClearSearchFocus = useCallback(() => {
    setSearchFocusMemberId(null);
    setSelectedMemberId(null);
    setHighlightIds([]);
    onMemberSelect?.(null);
  }, [onMemberSelect]);

  useEffect(() => {
    const modalOpen = addMemberOpen || shareModalOpen || printModalOpen || editMemberId != null;
    if (!modalOpen && searchFocusMemberId == null) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (printModalOpen) setPrintModalOpen(false);
        else if (shareModalOpen) setShareModalOpen(false);
        else if (editMemberId != null) setEditMemberId(null);
        else if (addMemberOpen) setAddMemberOpen(false);
        else if (searchFocusMemberId != null) handleClearSearchFocus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addMemberOpen, editMemberId, handleClearSearchFocus, printModalOpen, searchFocusMemberId, shareModalOpen]);

  const handleSearchSelect = useCallback((person: PersonSummary) => {
    setSelectedMemberId(person.id);
    setHighlightIds([person.id]);
    setSearchFocusMemberId(person.id);
    onMemberSelect?.(person.id);
  }, [onMemberSelect]);

  const handleFocusMember = useCallback((memberId: number) => {
    setSelectedMemberId(memberId);
    setHighlightIds([memberId]);
    setSearchFocusMemberId(memberId);
    onMemberSelect?.(memberId);
  }, [onMemberSelect]);

  const handleMemberUpdated = useCallback(async () => {
    if (onTreeRefresh) {
      await onTreeRefresh();
    }
  }, [onTreeRefresh]);

  const editMember = useMemo(
    () => (editMemberId != null
      ? members.find((member) => member.id === editMemberId) ?? null
      : null),
    [editMemberId, members],
  );

  const editPerson = useMemo(
    () => (editMemberId != null && people
      ? people.find((person) => person.id === editMemberId) ?? null
      : null),
    [editMemberId, people],
  );

  const handleOpenEditMember = useCallback((memberId: number) => {
    if (!canManageMembers) return;
    setEditMemberId(memberId);
    setSearchFocusMemberId(null);
    setSelectedMemberId(memberId);
    setHighlightIds([memberId]);
    onMemberSelect?.(memberId);
  }, [canManageMembers, onMemberSelect]);

  const handleEditMemberSuccess = useCallback(async () => {
    await handleMemberUpdated();
    setEditMemberId(null);
    showToast('تم حفظ التعديلات');
  }, [handleMemberUpdated, showToast]);

  const handleEditMemberDeleted = useCallback(async () => {
    await handleMemberUpdated();
    setEditMemberId(null);
    setSearchFocusMemberId(null);
    setSelectedMemberId(null);
    setHighlightIds([]);
    onMemberSelect?.(null);
    showToast('تم حذف الفرد');
  }, [handleMemberUpdated, onMemberSelect, showToast]);

  const handleDeleteMember = useCallback(async (memberId: number) => {
    if (!canManageMembers) return;

    const member = members.find((item) => item.id === memberId);
    if (!member) return;

    const isFounder = member.isFamilyHead ?? false;
    const childrenCount = members.filter((item) => (
      item.fatherId === member.id || item.motherId === member.id
    )).length;

    if (isFounder || childrenCount > 0) return;

    const displayName = isFounder ? member.fullName : getMemberFirstName(member.fullName);
    const confirmed = window.confirm(
      `هل تريد حذف «${displayName}»؟\nسيتم حذف بيانات هذا الفرد نهائيًا ولا يمكن التراجع.`,
    );
    if (!confirmed) return;

    try {
      await deletePerson(familyId, memberId);
      unregisterMarriageForPerson(familyId, memberId);
      await handleEditMemberDeleted();
    } catch (err) {
      showToast(toApiError(err).message);
    }
  }, [canManageMembers, familyId, handleEditMemberDeleted, members, showToast]);

  const handleSearchEnter = useCallback((query: string, results: PersonSummary[]) => {
    const ids = findMemberIdsByNameQuery(members, query);
    if (ids.length > 0) {
      setHighlightIds(ids);
      setSelectedMemberId(ids[0]);
      setSearchFocusMemberId(ids[0]);
      onMemberSelect?.(ids[0]);
      return;
    }
    if (results.length > 0) {
      setHighlightIds(results.map((person) => person.id));
      setSelectedMemberId(results[0].id);
      setSearchFocusMemberId(results[0].id);
      onMemberSelect?.(results[0].id);
    }
  }, [members, onMemberSelect]);

  const handleSearchClear = useCallback(() => {
    setHighlightIds([]);
    setSearchFocusMemberId(null);
  }, []);

  return (
    <div
      className={`family-forest${backgroundSettings.mode === 'solid' ? ' is-solid-bg' : ''}`}
      ref={forestExportRef}
      dir="rtl"
      lang="ar"
      style={
        backgroundSettings.mode === 'solid'
          ? { backgroundColor: backgroundSettings.solidColor }
          : undefined
      }
    >
      {backgroundSettings.mode === 'image' ? (
        <>
          <div className="family-forest__bg" aria-hidden />
          <div className="family-forest__atmosphere" aria-hidden />
          <div className="family-forest__gradient-top" aria-hidden />
          <div className="family-forest__gradient-bottom" aria-hidden />
        </>
      ) : null}

      <ForestPageHeader
        familyName={familyName}
        familyId={familyId}
        highlightIds={highlightIds}
        onAddMember={canManageMembers ? handleOpenAddMember : undefined}
        onSearchSelect={handleSearchSelect}
        onSearchEnter={handleSearchEnter}
        onSearchClear={handleSearchClear}
      />

      <div className="family-forest__scroll">
        <ReactFlowProvider>
          <FamilyForestCanvas
            members={members}
            people={people}
            familyName={familyName}
            familyId={familyId}
            editable={canManageMembers}
            screenWidth={screenSize.width}
            screenHeight={screenSize.height}
            selectedMemberId={selectedMemberId}
            highlightIds={highlightIds}
            searchFocusMemberId={searchFocusMemberId}
            justAddedMemberId={justAddedMemberId}
            onClearSearchFocus={handleClearSearchFocus}
            onFocusMember={canManageMembers ? handleFocusMember : undefined}
            onMemberSelect={onMemberSelect}
            onSelectMember={setSelectedMemberId}
            onMemberUpdated={canManageMembers ? handleMemberUpdated : undefined}
            onOpenEditMember={canManageMembers ? handleOpenEditMember : undefined}
            onDeleteMember={canManageMembers ? (memberId) => void handleDeleteMember(memberId) : undefined}
            onShare={() => setShareModalOpen(true)}
            onPrint={() => setPrintModalOpen(true)}
            onToast={showToast}
          />
        </ReactFlowProvider>
      </div>

      {canManageMembers ? (
        <AddMemberModal
          open={addMemberOpen}
          familyId={familyId}
          members={members}
          hasFounder={hasFounder}
          onClose={() => setAddMemberOpen(false)}
          onSuccess={(personId) => void handleMemberAdded(personId)}
        />
      ) : null}

      {canManageMembers ? (
        <EditMemberModal
          open={editMemberId != null}
          familyId={familyId}
          member={editMember}
          person={editPerson}
          members={members}
          onClose={() => setEditMemberId(null)}
          onSuccess={() => void handleEditMemberSuccess()}
        />
      ) : null}

      <ShareFamilyTreeModal
        open={shareModalOpen}
        familyId={familyId}
        familyName={familyName}
        memberCount={members.length}
        exportTargetRef={forestExportRef}
        flowHandleRef={flowHandleRef}
        onClose={() => setShareModalOpen(false)}
        onToast={showToast}
      />

      <PrintFamilyTreeModal
        open={printModalOpen}
        familyName={familyName}
        members={members}
        exportTargetRef={forestExportRef}
        flowHandleRef={flowHandleRef}
        onClose={() => setPrintModalOpen(false)}
        onToast={showToast}
      />

      <TreeBackgroundPicker
        settings={backgroundSettings}
        onChange={setBackgroundSettings}
      />

      {typeof document !== 'undefined' ? createPortal(
        <div
          className={`family-forest-toast${toastMessage ? ' show' : ''}`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
