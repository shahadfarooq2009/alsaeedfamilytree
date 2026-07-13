import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type OnMove,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import type { MemberPanelAnchor } from '../../utils/computeMemberPanelAnchor';
import {
  buildFamilyTreeFlowLayout,
  type FamilyTreeNodeData,
} from '../../utils/buildFamilyTreeFlowLayout';
import { prepareBranchSubtreeForFlow } from '../../utils/familyForest/getBranchSubtreeMembers';
import { getForestBranchColor } from '../../utils/familyForest/branchColors';
import { computeFitViewport } from '../../utils/familyTreeFlowViewport';
import { computeForestHoverAnchor } from '../../utils/familyForest/forestHoverAnchor';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { FamilyTreeFlowNode } from '../reference-tree/FamilyTreeFlowNode';
import { BranchFamilyEdge } from './BranchFamilyEdge';
import { BranchFamilyBoard } from './BranchFamilyBoard';
import { ForestMemberHoverCard } from './ForestMemberHoverCard';
import { IconClose, IconDownload, IconShare } from '../reference-tree/referenceTreeIcons';
import {
  downloadBranchMapAsPng,
  shareBranchMapAsPng,
} from '../../utils/exportBranchMapImage';
import '../reference-tree/FamilyTreeFlow.css';

const HOVER_SHOW_DELAY_MS = 140;
const HOVER_HIDE_DELAY_MS = 120;

const flowNodeTypes = {
  familyMember: FamilyTreeFlowNode,
};

const flowEdgeTypes = {
  branchFamily: BranchFamilyEdge,
};

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;
const BRANCH_FIT_MAX_ZOOM = 1;
const BRANCH_READABLE_MIN_ZOOM = 0.48;
const EXPAND_MS = 420;
const CLOSE_MS = 360;

export interface BranchExpandAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BranchExpandState {
  branchHeadId: number;
  branchName: string;
  branchIndex: number;
  memberCount: number;
  anchor: BranchExpandAnchor;
  /** Gen-2 branch heads open the family board instead of a full flow tree. */
  useFamilyBoard?: boolean;
  /** Show share/download actions for gen-3 family map modals. */
  showMapActions?: boolean;
}

interface BranchFamilyTreeProps {
  members: FamilyMemberInput[];
  branchHeadId: number;
  familyId?: number;
  canvasWidth: number;
  canvasHeight: number;
  branchColor: string;
  canvasRef: RefObject<HTMLDivElement | null>;
  onMemberHoverStart?: (memberId: number) => void;
  onMemberHoverEnd?: () => void;
  onFlowMove?: () => void;
  onMemberDrillDown?: (
    data: FamilyTreeNodeData,
    anchor: BranchExpandAnchor,
    isGen3Member?: boolean,
  ) => void;
}

export interface BranchFamilyTreeHandle {
  prepareForExport: () => Promise<void>;
}

const BranchFamilyTree = forwardRef<BranchFamilyTreeHandle, BranchFamilyTreeProps>(function BranchFamilyTree({
  members,
  branchHeadId,
  familyId,
  canvasWidth,
  canvasHeight,
  branchColor,
  canvasRef,
  onMemberHoverStart,
  onMemberHoverEnd,
  onFlowMove,
  onMemberDrillDown,
}, ref) {
  const { setViewport } = useReactFlow();

  const branchMembers = useMemo(
    () => prepareBranchSubtreeForFlow(members, branchHeadId, familyId),
    [branchHeadId, familyId, members],
  );

  const layout = useMemo(
    () => buildFamilyTreeFlowLayout(branchMembers, null, [], {
      allMembers: branchMembers,
      maxVisibleGenerations: 6,
      childCountMembers: branchMembers,
      thinEdges: true,
      compactVertical: true,
      layoutMaxWidth: canvasWidth,
    }),
    [branchMembers, canvasWidth],
  );

  const fitNodes = useMemo(
    () => layout.nodes.filter((node) => node.type === 'familyMember'),
    [layout.nodes],
  );

  const applyFitViewport = useCallback(() => {
    if (fitNodes.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) return;

    const viewport = computeFitViewport(
      fitNodes,
      canvasWidth,
      canvasHeight,
      { padding: 0.08, maxZoom: BRANCH_FIT_MAX_ZOOM, preferWidth: true },
    );
    const fitZoom = viewport.zoom;
    setViewport({
      ...viewport,
      zoom: Math.min(
        BRANCH_FIT_MAX_ZOOM,
        fitZoom < BRANCH_READABLE_MIN_ZOOM
          ? Math.max(MIN_ZOOM, fitZoom)
          : Math.max(BRANCH_READABLE_MIN_ZOOM, fitZoom),
      ),
    });
  }, [canvasHeight, canvasWidth, fitNodes, setViewport]);

  useEffect(() => {
    if (fitNodes.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) return;

    const timer = window.setTimeout(() => {
      applyFitViewport();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [applyFitViewport, canvasHeight, canvasWidth, fitNodes.length, layout.edges.length]);

  useImperativeHandle(ref, () => ({
    prepareForExport: async () => {
      applyFitViewport();
      await new Promise((resolve) => window.setTimeout(resolve, 280));
    },
  }), [applyFitViewport]);

  const onNodeClick = useCallback((_event: MouseEvent, node: Node) => {
    if (node.type !== 'familyMember' || !onMemberDrillDown) return;

    const data = node.data as FamilyTreeNodeData;
    if (data.isFounder || !data.isExpandable) return;

    const card = canvasRef.current?.querySelector<HTMLElement>(`[data-id="${data.memberId}"]`);
    const rect = card?.getBoundingClientRect();
    if (!rect) return;

    onMemberDrillDown(data, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }, data.generationClass === 'g3');
  }, [canvasRef, onMemberDrillDown]);

  const onNodeMouseEnter = useCallback((_event: MouseEvent, node: Node) => {
    if (node.type !== 'familyMember' || !onMemberHoverStart) return;
    const data = node.data as FamilyTreeNodeData;
    onMemberHoverStart(data.memberId);
  }, [onMemberHoverStart]);

  const onNodeMouseLeave = useCallback((_event: MouseEvent, node: Node) => {
    if (node.type !== 'familyMember' || !onMemberHoverEnd) return;
    onMemberHoverEnd();
  }, [onMemberHoverEnd]);

  const onMove: OnMove = useCallback(() => {
    onFlowMove?.();
  }, [onFlowMove]);

  if (branchMembers.length === 0 || fitNodes.length === 0) {
    return (
      <div className="branch-family-tree-empty" role="status">
        <p>لا توجد بيانات كافية لعرض خريطة هذه العائلة.</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={layout.nodes}
      edges={layout.edges}
      nodeTypes={flowNodeTypes}
      edgeTypes={flowEdgeTypes}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      fitView={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onMove={onMove}
      panOnDrag
      panOnScroll
      zoomOnScroll
      zoomOnPinch
      proOptions={{ hideAttribution: true }}
      className="branch-family-tree-flow family-tree-flow is-branch-map"
      style={{ ['--branch-edge-accent' as string]: branchColor }}
    />
  );
});

interface BranchExpandPanelProps {
  state: BranchExpandState;
  members: FamilyMemberInput[];
  familyId?: number;
  panelTarget: BranchExpandAnchor;
  branchColor: string;
  isOpen: boolean;
  isClosing: boolean;
  isNested?: boolean;
  eyebrow: string;
  canvasRef: RefObject<HTMLDivElement | null>;
  branchTreeRef?: RefObject<BranchFamilyTreeHandle | null>;
  mapActionBusy?: 'share' | 'download' | null;
  onClose: () => void;
  onShareMap?: () => void;
  onDownloadMap?: () => void;
  onMemberHoverStart?: (memberId: number) => void;
  onMemberHoverEnd?: () => void;
  onFlowMove?: () => void;
  onMemberDrillDown?: (
    data: FamilyTreeNodeData,
    anchor: BranchExpandAnchor,
    isGen3Member?: boolean,
  ) => void;
}

function BranchExpandPanel({
  state,
  members,
  familyId,
  panelTarget,
  branchColor,
  isOpen,
  isClosing,
  isNested = false,
  eyebrow,
  canvasRef,
  branchTreeRef,
  mapActionBusy = null,
  onClose,
  onShareMap,
  onDownloadMap,
  onMemberHoverStart,
  onMemberHoverEnd,
  onFlowMove,
  onMemberDrillDown,
}: BranchExpandPanelProps) {
  const canvasHeight = Math.max(380, panelTarget.height - 60);
  const canvasWidth = Math.max(640, panelTarget.width - 20);
  const frame = isOpen && !isClosing ? panelTarget : state.anchor;
  const titleId = isNested ? 'memberDrillTitle' : 'branchExpandTitle';
  const useFamilyBoard = state.useFamilyBoard && !isNested;
  const showMapActions = Boolean(state.showMapActions && !useFamilyBoard);

  return (
    <>
      <div
        className={[
          'branch-expand-backdrop',
          isNested ? 'is-nested' : '',
          isOpen && !isClosing ? 'is-visible' : '',
          isClosing ? 'is-closing' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden
        onClick={onClose}
      />

      <div
        className={[
          'branch-expand-panel',
          useFamilyBoard ? 'is-family-board' : '',
          isNested ? 'is-nested' : '',
          isOpen && !isClosing ? 'is-open' : '',
          isClosing ? 'is-closing' : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          ['--branch-accent' as string]: branchColor,
          ['--expand-duration' as string]: `${EXPAND_MS}ms`,
          left: `${frame.left}px`,
          top: `${frame.top}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="branch-expand-panel__header">
          <div className="branch-expand-panel__head-text">
            {useFamilyBoard ? (
              <h2 id={titleId} className="branch-expand-panel__title">
                فرع {state.branchName} - {state.memberCount} فرد
              </h2>
            ) : (
              <>
                <p className="branch-expand-panel__eyebrow">{eyebrow}</p>
                <h2 id={titleId} className="branch-expand-panel__title">
                  {state.branchName}
                </h2>
                <p className="branch-expand-panel__meta">{state.memberCount} فرداً</p>
              </>
            )}
          </div>
          <div className="branch-expand-panel__header-actions">
            {showMapActions ? (
              <div className="branch-expand-panel__actions">
                <button
                  type="button"
                  className="branch-expand-panel__action-btn"
                  disabled={mapActionBusy != null}
                  onClick={onShareMap}
                >
                  <IconShare />
                  <span>{mapActionBusy === 'share' ? 'جاري المشاركة...' : 'مشاركة'}</span>
                </button>
                <button
                  type="button"
                  className="branch-expand-panel__action-btn branch-expand-panel__action-btn--primary"
                  disabled={mapActionBusy != null}
                  onClick={onDownloadMap}
                >
                  <IconDownload />
                  <span>{mapActionBusy === 'download' ? 'جاري التحميل...' : 'تحميل'}</span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="branch-expand-panel__close"
              aria-label="إغلاق"
              onClick={onClose}
            >
              <IconClose />
            </button>
          </div>
        </header>

        <div
          className={[
            'branch-expand-panel__canvas',
            useFamilyBoard ? 'is-family-board' : '',
            isOpen && !isClosing ? 'is-ready' : '',
          ].filter(Boolean).join(' ')}
          style={{ height: canvasHeight }}
        >
          {isOpen && !isClosing ? (
            useFamilyBoard ? (
              <BranchFamilyBoard
                members={members}
                branchHeadId={state.branchHeadId}
                branchName={state.branchName}
                branchIndex={state.branchIndex}
                branchColor={branchColor}
                familyId={familyId}
                onBackToMain={onClose}
              />
            ) : (
              <ReactFlowProvider>
                <div className="branch-expand-panel__stage" ref={canvasRef}>
                  <BranchFamilyTree
                    ref={branchTreeRef}
                    members={members}
                    branchHeadId={state.branchHeadId}
                    familyId={familyId}
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    branchColor={branchColor}
                    canvasRef={canvasRef}
                    onMemberHoverStart={onMemberHoverStart}
                    onMemberHoverEnd={onMemberHoverEnd}
                    onFlowMove={onFlowMove}
                    onMemberDrillDown={onMemberDrillDown}
                  />
                </div>
              </ReactFlowProvider>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}

interface BranchExpandedViewProps {
  branch: BranchExpandState | null;
  members: FamilyMemberInput[];
  people?: PersonSummary[];
  familyId?: number;
  editable?: boolean;
  onEditRequest?: (memberId: number) => void;
  onDeleteRequest?: (memberId: number) => void;
  onToast?: (message: string) => void;
  onClose: () => void;
}

export function BranchExpandedView({
  branch,
  members,
  people = [],
  familyId,
  editable = false,
  onEditRequest,
  onDeleteRequest,
  onToast,
  onClose,
}: BranchExpandedViewProps) {
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>('entering');
  const [drillDown, setDrillDown] = useState<BranchExpandState | null>(null);
  const [drillPhase, setDrillPhase] = useState<'entering' | 'open' | 'closing'>('entering');

  const mainCanvasRef = useRef<HTMLDivElement>(null);
  const drillCanvasRef = useRef<HTMLDivElement>(null);
  const mainTreeRef = useRef<BranchFamilyTreeHandle>(null);
  const drillTreeRef = useRef<BranchFamilyTreeHandle>(null);
  const [mapActionBusy, setMapActionBusy] = useState<'share' | 'download' | null>(null);
  const hoverCardRef = useRef<HTMLElement>(null);
  const showHoverTimerRef = useRef<number | null>(null);
  const hideHoverTimerRef = useRef<number | null>(null);
  const [hoveredMemberId, setHoveredMemberId] = useState<number | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const [hoverAnchor, setHoverAnchor] = useState<MemberPanelAnchor | null>(null);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const isDrillOpen = drillPhase === 'open';
  const activeCanvasRef = drillDown && isDrillOpen ? drillCanvasRef : mainCanvasRef;

  const clearHoverTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearBranchHover = useCallback(() => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
    setHoverVisible(false);
    setHoveredMemberId(null);
    setHoverAnchor(null);
  }, [clearHoverTimer]);

  const updateHoverAnchor = useCallback(() => {
    if (hoveredMemberId == null) {
      setHoverAnchor(null);
      return;
    }

    const card = activeCanvasRef.current?.querySelector<HTMLElement>(
      `[data-id="${hoveredMemberId}"]`,
    );
    if (!card) return;

    setHoverAnchor(computeForestHoverAnchor(card, hoverCardRef.current));
  }, [activeCanvasRef, hoveredMemberId]);

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

  const handleMemberHoverStart = useCallback((memberId: number) => {
    scheduleShowHover(memberId);
  }, [scheduleShowHover]);

  const handleMemberHoverEnd = useCallback(() => {
    clearHoverTimer(showHoverTimerRef);
    scheduleHideHover();
  }, [clearHoverTimer, scheduleHideHover]);

  const handleHoverCardEnter = useCallback(() => {
    clearHoverTimer(hideHoverTimerRef);
  }, [clearHoverTimer]);

  const handleHoverCardLeave = useCallback(() => {
    scheduleHideHover();
  }, [scheduleHideHover]);

  const handleFlowMove = useCallback(() => {
    if (hoverVisible && hoveredMemberId != null) {
      window.requestAnimationFrame(updateHoverAnchor);
    }
  }, [hoverVisible, hoveredMemberId, updateHoverAnchor]);

  useLayoutEffect(() => {
    if (!hoverVisible || hoveredMemberId == null) return undefined;
    updateHoverAnchor();
    const frame = window.requestAnimationFrame(updateHoverAnchor);
    window.addEventListener('resize', updateHoverAnchor);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateHoverAnchor);
    };
  }, [hoverVisible, hoveredMemberId, updateHoverAnchor, drillDown, isDrillOpen]);

  useEffect(() => () => {
    clearHoverTimer(showHoverTimerRef);
    clearHoverTimer(hideHoverTimerRef);
  }, [clearHoverTimer]);

  const branchColor = branch ? getForestBranchColor(branch.branchIndex) : '#5a7f9e';

  const panelTarget = useMemo(() => {
    if (typeof window === 'undefined') {
      return { left: 0, top: 0, width: 1100, height: 680 };
    }
    const width = Math.min(1240, Math.round(window.innerWidth * 0.92));
    const height = Math.min(680, Math.round(window.innerHeight * 0.78));
    return {
      left: Math.round((window.innerWidth - width) / 2),
      top: Math.round((window.innerHeight - height) / 2),
      width,
      height,
    };
  }, [branch]);

  const handleClose = useCallback(() => {
    clearBranchHover();
    setPhase('closing');
    window.setTimeout(onClose, CLOSE_MS);
  }, [clearBranchHover, onClose]);

  const handleDrillClose = useCallback(() => {
    clearBranchHover();
    setDrillPhase('closing');
    window.setTimeout(() => {
      setDrillDown(null);
      setDrillPhase('entering');
    }, CLOSE_MS);
  }, [clearBranchHover]);

  const handleMemberDrillDown = useCallback((
    data: FamilyTreeNodeData,
    anchor: BranchExpandAnchor,
    isGen3Member = false,
  ) => {
    if (branch?.useFamilyBoard) return;
    if (!isGen3Member && (!data.isExpandable || data.childCount <= 0)) return;

    const subtree = prepareBranchSubtreeForFlow(members, data.memberId, familyId);
    if (subtree.length === 0) return;
    if (!isGen3Member && subtree.length <= 1) return;

    clearBranchHover();
    setDrillDown({
      branchHeadId: data.memberId,
      branchName: data.displayName || getMemberFirstName(data.fullName),
      branchIndex: branch?.branchIndex ?? 0,
      memberCount: subtree.length,
      anchor,
      showMapActions: isGen3Member,
    });
    setDrillPhase('entering');
    window.requestAnimationFrame(() => setDrillPhase('open'));
  }, [branch?.branchIndex, branch?.useFamilyBoard, clearBranchHover, familyId, members]);

  useEffect(() => {
    if (!branch) {
      setPhase('entering');
      setDrillDown(null);
      setDrillPhase('entering');
      clearBranchHover();
      return undefined;
    }

    setPhase('entering');
    const frame = window.requestAnimationFrame(() => {
      setPhase('open');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [branch, clearBranchHover]);

  useEffect(() => {
    if (!branch) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drillDown && drillPhase === 'open') {
        handleDrillClose();
        return;
      }
      handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [branch, drillDown, drillPhase, handleClose, handleDrillClose]);

  const handleEditRequest = useCallback((memberId: number) => {
    clearBranchHover();
    onEditRequest?.(memberId);
  }, [clearBranchHover, onEditRequest]);

  const handleDownloadMap = useCallback(async (
    targetState: BranchExpandState,
  ) => {
    setMapActionBusy('download');
    try {
      clearBranchHover();
      const layoutMaxWidth = Math.max(640, panelTarget.width - 20);
      await downloadBranchMapAsPng({
        members,
        branchHeadId: targetState.branchHeadId,
        familyId,
        layoutMaxWidth,
        mapName: targetState.branchName,
      });
      onToast?.('تم تنزيل صورة الخريطة');
    } catch {
      onToast?.('تعذّر تحميل صورة الخريطة');
    } finally {
      setMapActionBusy(null);
    }
  }, [clearBranchHover, familyId, members, onToast, panelTarget.width]);

  const handleShareMap = useCallback(async (
    targetState: BranchExpandState,
  ) => {
    setMapActionBusy('share');
    try {
      clearBranchHover();
      const layoutMaxWidth = Math.max(640, panelTarget.width - 20);
      const result = await shareBranchMapAsPng({
        members,
        branchHeadId: targetState.branchHeadId,
        familyId,
        layoutMaxWidth,
        mapName: targetState.branchName,
      });
      if (result === 'shared') {
        onToast?.('تمت مشاركة الخريطة');
      } else if (result === 'unsupported') {
        onToast?.('تم تنزيل الصورة — يمكنك مشاركتها من جهازك');
      }
    } catch {
      onToast?.('تعذّر مشاركة الخريطة');
    } finally {
      setMapActionBusy(null);
    }
  }, [clearBranchHover, familyId, members, onToast, panelTarget.width]);

  if (!branch || typeof document === 'undefined') return null;

  const isOpen = phase === 'open';
  const isClosing = phase === 'closing';
  const isDrillClosing = drillPhase === 'closing';
  const hoveredMember = hoveredMemberId != null ? membersById.get(hoveredMemberId) ?? null : null;
  const hoveredPerson = hoveredMemberId != null ? peopleById.get(hoveredMemberId) ?? null : null;

  return createPortal(
    <>
      <BranchExpandPanel
        state={branch}
        members={members}
        familyId={familyId}
        panelTarget={panelTarget}
        branchColor={branchColor}
        isOpen={isOpen}
        isClosing={isClosing}
        eyebrow="عائلة الفرع"
        canvasRef={mainCanvasRef}
        branchTreeRef={mainTreeRef}
        mapActionBusy={mapActionBusy}
        onClose={handleClose}
        onShareMap={branch.showMapActions
          ? () => void handleShareMap(branch)
          : undefined}
        onDownloadMap={branch.showMapActions
          ? () => void handleDownloadMap(branch)
          : undefined}
        onMemberHoverStart={handleMemberHoverStart}
        onMemberHoverEnd={handleMemberHoverEnd}
        onFlowMove={handleFlowMove}
        onMemberDrillDown={handleMemberDrillDown}
      />

      {drillDown ? (
        <BranchExpandPanel
          state={drillDown}
          members={members}
          familyId={familyId}
          panelTarget={panelTarget}
          branchColor={branchColor}
          isOpen={isDrillOpen}
          isClosing={isDrillClosing}
          isNested
          eyebrow="عائلة الفرد"
          canvasRef={drillCanvasRef}
          branchTreeRef={drillTreeRef}
          mapActionBusy={mapActionBusy}
          onClose={handleDrillClose}
          onShareMap={drillDown.showMapActions
            ? () => void handleShareMap(drillDown)
            : undefined}
          onDownloadMap={drillDown.showMapActions
            ? () => void handleDownloadMap(drillDown)
            : undefined}
          onMemberHoverStart={handleMemberHoverStart}
          onMemberHoverEnd={handleMemberHoverEnd}
          onFlowMove={handleFlowMove}
        />
      ) : null}

      {hoveredMember && typeof document !== 'undefined' ? (
        <ForestMemberHoverCard
          ref={hoverCardRef}
          member={hoveredMember}
          members={members}
          person={hoveredPerson}
          familyId={familyId}
          anchor={hoverAnchor}
          visible={hoverVisible && isOpen}
          inBranchModal
          editable={editable}
          onEditRequest={handleEditRequest}
          onDeleteRequest={onDeleteRequest}
          onPointerEnter={handleHoverCardEnter}
          onPointerLeave={handleHoverCardLeave}
        />
      ) : null}
    </>,
    document.body,
  );
}
