import { useEffect, useMemo, useRef, useState } from 'react';
import treeBackground from '../../assets/family-tree/reference/tree-background.svg';
import { useMemberPanelAnchor } from '../../hooks/useMemberPanelAnchor';
import { useFamilyTreeLayout } from '../../hooks/useFamilyTreeLayout';
import { useTreePanZoom } from '../../hooks/useTreePanZoom';
import { buildFocusPathAnimationOrder } from '../../utils/focusPathOrder';
import { DEFAULT_STAGE, stageFromViewport } from '../../utils/treeLayout/stageBounds';
import { treeScaleCssVars } from '../../utils/treeLayout/treeLayoutScale';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import type { PersonDetail, PersonSummary } from '../../types/person';
import { ReferenceBranchConnectors } from './ReferenceBranchConnectors';
import { ReferenceMemberFocusPanel } from './ReferenceMemberFocusPanel';
import { ReferenceMemberCards } from './ReferenceMemberCards';
import { ReferenceTreeHeader } from './ReferenceTreeHeader';
import { ReferenceTreeToolbar, type ToolbarAction } from './ReferenceTreeToolbar';

interface ReferenceTreeCanvasProps {
  familyMembers: FamilyMemberInput[];
  familyName?: string | null;
  familyId: number;
  selectedId: number | null;
  highlightIds: number[];
  popoverPerson: PersonDetail | PersonSummary | null;
  popoverOpen: boolean;
  canvasRef: React.RefObject<HTMLElement | null>;
  onSelectMember: (id: number) => void;
  onToolbarAction: (action: ToolbarAction) => void;
  onAddMember: () => void;
  onSearchResultsChange: (results: PersonSummary[]) => void;
  onSearchSelect: (person: PersonSummary) => void;
  onClosePopover: () => void;
  onViewFullProfile: () => void;
  onEditMemberAvatar: (memberId: number) => void;
}

export function ReferenceTreeCanvas({
  familyMembers,
  familyName,
  familyId,
  selectedId,
  highlightIds,
  popoverPerson,
  popoverOpen,
  canvasRef,
  onSelectMember,
  onToolbarAction,
  onAddMember,
  onSearchResultsChange,
  onSearchSelect,
  onClosePopover,
  onViewFullProfile,
  onEditMemberAvatar,
}: ReferenceTreeCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const lastFocusedMemberIdRef = useRef<number | null>(null);
  const [stage, setStage] = useState(DEFAULT_STAGE);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateStage = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStage(stageFromViewport(rect.width, rect.height));
      }
    };

    updateStage();
    const observer = new ResizeObserver(updateStage);
    observer.observe(element);
    window.addEventListener('resize', updateStage);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateStage);
    };
  }, []);

  const normalizedMembers = familyMembers;

  const layout = useFamilyTreeLayout(normalizedMembers, stage);

  const layoutSignature = `${layout.members.length}-${layout.scale.tier}-${stage.width}-${stage.height}-${layout.validation?.overlappingCards ?? 0}`;

  const panZoom = useTreePanZoom({
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    contentBounds: layout.contentBounds,
    viewportRef,
    fitAllMembers: true,
    layoutFillsStage: layout.layoutFillsStage ?? false,
    disablePanZoom: false,
    layoutSignature,
  });

  const scaleCssVars = useMemo(
    () => treeScaleCssVars(layout.scale),
    [layout.scale],
  );

  const popoverMember = useMemo(
    () => (popoverOpen && selectedId != null
      ? layout.members.find((member) => member.id === selectedId) ?? null
      : null),
    [layout.members, popoverOpen, selectedId],
  );

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const relationFocusId = selectedId ?? hoveredId;

  const focusPathIds = useMemo(() => {
    if (relationFocusId == null) return [];

    const byId = new Map(layout.members.map((member) => [member.id, member]));
    const path: number[] = [];
    const seen = new Set<number>();
    let current = byId.get(relationFocusId);

    while (current && !seen.has(current.id)) {
      path.push(current.id);
      seen.add(current.id);
      if (current.fatherId == null) break;
      current = byId.get(current.fatherId);
    }

    return path;
  }, [layout.members, relationFocusId]);

  const focusChildIds = useMemo(
    () => (relationFocusId == null
      ? []
      : layout.members
        .filter((member) => member.fatherId === relationFocusId)
        .map((member) => member.id)),
    [layout.members, relationFocusId],
  );

  const siblingIds = useMemo(() => {
    if (relationFocusId == null) return [];
    const member = layout.members.find((entry) => entry.id === relationFocusId);
    if (!member?.fatherId) return [];
    return layout.members
      .filter((entry) => entry.fatherId === member.fatherId && entry.id !== relationFocusId)
      .map((entry) => entry.id);
  }, [layout.members, relationFocusId]);

  const pathAnimationOrder = useMemo(
    () => buildFocusPathAnimationOrder(focusPathIds, selectedId, focusChildIds),
    [focusChildIds, focusPathIds, selectedId],
  );

  const [pathAnimKey, setPathAnimKey] = useState(0);
  const [panelMember, setPanelMember] = useState(popoverMember);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    if (selectedId != null) {
      setPathAnimKey((value) => value + 1);
      lastFocusedMemberIdRef.current = selectedId;
    }
  }, [selectedId]);

  useEffect(() => {
    if (!popoverOpen) {
      setPanelVisible(false);
      return;
    }
    if (popoverMember) {
      setPanelMember(popoverMember);
    }
  }, [popoverOpen, popoverMember]);

  useEffect(() => {
    if (!popoverOpen || !panelMember || panelVisible) return undefined;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [panelMember, panelVisible, popoverOpen]);

  useEffect(() => {
    if (!popoverOpen && panelMember) {
      const timer = window.setTimeout(() => setPanelMember(null), 300);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [popoverOpen, panelMember]);

  useEffect(() => {
    if (panelVisible && panelRef.current) {
      panelRef.current.focus();
    }
  }, [panelVisible, panelMember?.id]);

  useEffect(() => {
    if (popoverOpen || lastFocusedMemberIdRef.current == null || !membersRef.current) {
      return;
    }

    const memberId = lastFocusedMemberIdRef.current;
    lastFocusedMemberIdRef.current = null;
    const card = membersRef.current.querySelector<HTMLButtonElement>(`[data-id="${memberId}"]`);
    card?.focus();
  }, [popoverOpen]);

  const panelAnchor = useMemberPanelAnchor({
    viewportRef,
    membersRef,
    panelRef,
    selectedId,
    panelOpen: popoverOpen,
    panelVisible,
    panX: panZoom.panX,
    panY: panZoom.panY,
    scale: panZoom.scale,
  });

  const handleToolbarAction = (action: ToolbarAction) => {
    if (action === 'zoom-in') {
      panZoom.zoomIn();
      return;
    }
    if (action === 'zoom-out') {
      panZoom.zoomOut();
      return;
    }
    if (action === 'recenter' || action === 'fit-all') {
      panZoom.recenter();
      return;
    }
    onToolbarAction(action);
  };

  return (
    <main
      className="canvas family-tree-scene"
      id="canvas"
      ref={canvasRef as React.RefObject<HTMLElement>}
    >
      <img className="tree-bg" id="treeBg" src={treeBackground} alt="شجرة العائلة" />
      <div className="layer-atmosphere" />
      <div className="tree-top-gradient" aria-hidden />
      <div className="tree-bottom-gradient" aria-hidden />

      <ReferenceTreeHeader
        familyName={familyName}
        familyId={familyId}
        memberCount={normalizedMembers.length}
        highlightIds={highlightIds}
        onAddMember={onAddMember}
        onSearchResultsChange={onSearchResultsChange}
        onSearchSelect={onSearchSelect}
      />

      <div
        className={`family-tree-overlay family-tree-map-overlay family-tree-viewport${relationFocusId != null ? ' member-focus-active' : ''}`}
        ref={viewportRef}
        onPointerDown={(event) => {
          onClosePopover();
          panZoom.onPointerDown(event);
        }}
        onPointerMove={panZoom.onPointerMove}
        onPointerUp={panZoom.onPointerUp}
        onPointerCancel={panZoom.onPointerUp}
        onWheel={panZoom.onWheel}
        style={{ cursor: panZoom.isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="family-tree-map-inner family-tree-virtual-canvas family-tree-scaled"
          style={{
            width: `${layout.canvasWidth}px`,
            height: `${layout.canvasHeight}px`,
            transform: `translate(${panZoom.panX}px, ${panZoom.panY}px) scale(${panZoom.scale})`,
            transformOrigin: '0 0',
            ...scaleCssVars,
          }}
        >
          <ReferenceBranchConnectors
            connectors={layout.connectors}
            canvasWidth={layout.canvasWidth}
            canvasHeight={layout.canvasHeight}
            selectedId={selectedId}
            hoveredId={hoveredId}
            focusPathIds={focusPathIds}
            focusChildIds={focusChildIds}
            siblingIds={siblingIds}
            pathAnimationOrder={pathAnimationOrder}
            pathAnimKey={pathAnimKey}
          />
          <ReferenceMemberCards
            members={layout.members}
            layoutScale={layout.scale}
            selectedId={selectedId}
            hoveredId={hoveredId}
            focusPathIds={focusPathIds}
            focusChildIds={focusChildIds}
            siblingIds={siblingIds}
            highlightIds={highlightIds}
            membersRef={membersRef}
            onSelect={onSelectMember}
            onEditAvatar={onEditMemberAvatar}
            onHover={setHoveredId}
          />
        </div>

        {panelMember && (
          <ReferenceMemberFocusPanel
            ref={panelRef}
            member={panelMember}
            members={layout.members}
            person={popoverPerson}
            visible={panelVisible}
            anchor={panelAnchor}
            onClose={onClosePopover}
            onViewFullProfile={onViewFullProfile}
          />
        )}
      </div>

      <ReferenceTreeToolbar onAction={handleToolbarAction} />
    </main>
  );
}
