import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMemberPanelAnchor } from '../../hooks/useMemberPanelAnchor';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import type { TreeBackgroundSettings } from '../../utils/treeBackgroundStorage';
import type { PersonDetail, PersonSummary } from '../../types/person';
import type { FamilyTreeLayoutOptions } from '../../utils/buildFamilyTreeFlowLayout';
import { FamilyTreeFlow, type FamilyTreeFlowControls, type FamilyTreeFlowHandle } from './FamilyTreeFlow';
import { ReferenceMemberFocusPanel } from './ReferenceMemberFocusPanel';
import { ReferenceTreeHeader } from './ReferenceTreeHeader';
import { ReferenceTreeToolbar, type ToolbarAction } from './ReferenceTreeToolbar';

interface ReferenceTreeCanvasProps {
  familyMembers: FamilyMemberInput[];
  visibleMembers: FamilyMemberInput[];
  layoutOptions?: FamilyTreeLayoutOptions;
  expandedGen5ParentIds: Set<number>;
  onToggleGen5: (parentId: number) => void;
  familyName?: string | null;
  familyId: number;
  selectedId: number | null;
  highlightIds: number[];
  justAddedMemberId?: number | null;
  popoverPerson: PersonDetail | PersonSummary | null;
  popoverOpen: boolean;
  canvasRef: React.RefObject<HTMLElement | null>;
  exportTargetRef?: React.RefObject<HTMLElement | null>;
  onFlowHandleReady?: (handle: FamilyTreeFlowHandle | null) => void;
  onBeginMemberFocus: (id: number) => boolean;
  onCompleteMemberFocus: (id: number) => void;
  onToolbarAction: (action: ToolbarAction) => void;
  onPrint?: () => void;
  onAddMember: () => void;
  onSearchSelect: (person: PersonSummary) => void;
  onSearchEnter: (query: string, results: PersonSummary[]) => void;
  onSearchClear: () => void;
  onFlowControlsReady: (controls: FamilyTreeFlowControls) => void;
  onClosePopover: () => void;
  onMapPaneClick: () => void;
  onDismissPopoverKeepSelection: () => void;
  onEditMemberAvatar: (memberId: number) => void;
  onOpenForest?: () => void;
  shareModalOpen?: boolean;
  backgroundSettings: TreeBackgroundSettings;
}

export function ReferenceTreeCanvas({
  familyMembers,
  visibleMembers,
  layoutOptions,
  expandedGen5ParentIds,
  onToggleGen5,
  familyName,
  familyId,
  selectedId,
  highlightIds,
  justAddedMemberId = null,
  popoverPerson,
  popoverOpen,
  canvasRef,
  exportTargetRef,
  onFlowHandleReady,
  onBeginMemberFocus,
  onCompleteMemberFocus,
  onToolbarAction,
  onPrint,
  onAddMember,
  onSearchSelect,
  onSearchEnter,
  onSearchClear,
  onFlowControlsReady,
  onClosePopover,
  onMapPaneClick,
  onDismissPopoverKeepSelection,
  onEditMemberAvatar: _onEditMemberAvatar,
  onOpenForest,
  shareModalOpen = false,
  backgroundSettings,
}: ReferenceTreeCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const flowRef = useRef<FamilyTreeFlowHandle | null>(null);
  const [isAtDefaultViewport, setIsAtDefaultViewport] = useState(true);
  const [controlsReady, setControlsReady] = useState(false);
  const lastFocusedMemberIdRef = useRef<number | null>(null);
  const [viewportRevision, setViewportRevision] = useState(0);

  const popoverMember = useMemo(
    () => (popoverOpen && selectedId != null
      ? familyMembers.find((member) => member.id === selectedId) ?? null
      : null),
    [familyMembers, popoverOpen, selectedId],
  );

  const [panelMember, setPanelMember] = useState(popoverMember);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const wasPopoverOpenRef = useRef(popoverOpen);

  useEffect(() => {
    if (selectedId != null) {
      lastFocusedMemberIdRef.current = selectedId;
    }
  }, [selectedId]);

  useEffect(() => {
    const wasOpen = wasPopoverOpenRef.current;
    wasPopoverOpenRef.current = popoverOpen;

    if (popoverOpen) {
      setIsPanelClosing(false);
      if (popoverMember) {
        setPanelMember((current) => (
          current?.id === popoverMember.id ? current : popoverMember
        ));
      }
      return;
    }

    if (wasOpen && panelMember) {
      setIsPanelClosing(true);
      setPanelVisible(false);
    }
  }, [popoverOpen, popoverMember, panelMember]);

  const handlePanelExitComplete = useCallback(() => {
    setIsPanelClosing(false);
    setPanelMember(null);
  }, []);

  useEffect(() => {
    if (!popoverOpen || !panelMember || panelVisible) return undefined;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [panelMember, panelVisible, popoverOpen]);

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
    const card = membersRef.current.querySelector<HTMLElement>(`[data-id="${memberId}"]`);
    card?.focus();
  }, [popoverOpen]);

  const handleViewportChange = useCallback(() => {
    setViewportRevision((value) => value + 1);
  }, []);

  const panelAnchor = useMemberPanelAnchor({
    viewportRef,
    membersRef,
    panelRef,
    selectedId: selectedId ?? panelMember?.id ?? null,
    panelOpen: popoverOpen || isPanelClosing,
    panelVisible: popoverOpen || isPanelClosing,
    panX: 0,
    panY: 0,
    scale: 1,
    viewportRevision,
  });

  const handleFlowControlsReady = useCallback((controls: FamilyTreeFlowControls) => {
    setControlsReady(true);
    onFlowControlsReady(controls);
  }, [onFlowControlsReady]);

  const handleViewportPanStart = useCallback(() => {
    if (!popoverOpen) return;
    onDismissPopoverKeepSelection();
  }, [onDismissPopoverKeepSelection, popoverOpen]);

  const assignViewportRef = useCallback((element: HTMLDivElement | null) => {
    viewportRef.current = element;
    if (exportTargetRef) {
      exportTargetRef.current = element;
    }
  }, [exportTargetRef]);

  useEffect(() => {
    if (!controlsReady) return;
    onFlowHandleReady?.(flowRef.current);
  }, [controlsReady, onFlowHandleReady]);

  const invokeFlow = useCallback((action: (handle: FamilyTreeFlowHandle) => void) => {
    const handle = flowRef.current;
    if (handle) action(handle);
  }, []);

  const handleToolbarAction = useCallback((action: ToolbarAction) => {
    if (action === 'recenter' || action === 'fit-all') {
      invokeFlow((handle) => handle.fitView());
      return;
    }

    if (action === 'share' || action === 'print' || action === 'fullscreen') {
      onToolbarAction(action);
      return;
    }

    if (action === 'zoom-in') {
      invokeFlow((handle) => handle.zoomIn());
      return;
    }
    if (action === 'zoom-out') {
      invokeFlow((handle) => handle.zoomOut());
      return;
    }

    onToolbarAction(action);
  }, [invokeFlow, onToolbarAction]);

  return (
    <main
      className={`canvas family-tree-scene${backgroundSettings.mode === 'solid' ? ' is-solid-bg' : ''}`}
      id="canvas"
      ref={canvasRef as React.RefObject<HTMLElement>}
      style={
        backgroundSettings.mode === 'solid'
          ? { backgroundColor: backgroundSettings.solidColor, backgroundImage: 'none' }
          : undefined
      }
    >
      {backgroundSettings.mode === 'image' ? (
        <>
          <div className="layer-atmosphere" />
          <div className="tree-bottom-gradient" aria-hidden />
        </>
      ) : null}

      <ReferenceTreeHeader
        familyName={familyName}
        familyId={familyId}
        memberCount={familyMembers.length}
        highlightIds={highlightIds}
        onAddMember={onAddMember}
        onOpenForest={onOpenForest}
        onSearchSelect={onSearchSelect}
        onSearchEnter={onSearchEnter}
        onSearchClear={onSearchClear}
      />

      <div
        className={`family-tree-map-overlay family-tree-viewport${isAtDefaultViewport ? ' is-map-position-locked' : ''}`}
        ref={assignViewportRef}
      >
        {backgroundSettings.mode === 'image' ? (
          <div className="tree-top-gradient" aria-hidden />
        ) : null}

        <FamilyTreeFlow
          ref={(handle) => {
            flowRef.current = handle;
            onFlowHandleReady?.(handle);
          }}
          members={visibleMembers}
          layoutOptions={layoutOptions}
          selectedId={selectedId}
          highlightIds={highlightIds}
          justAddedMemberId={justAddedMemberId}
          membersRef={membersRef}
          onBeginMemberFocus={onBeginMemberFocus}
          onCompleteMemberFocus={onCompleteMemberFocus}
          onViewportChange={handleViewportChange}
          onDefaultViewportChange={setIsAtDefaultViewport}
          onPaneClick={onMapPaneClick}
          onViewportPanStart={handleViewportPanStart}
          onResetViewport={onDismissPopoverKeepSelection}
          onFlowControlsReady={handleFlowControlsReady}
          expandedGen5ParentIds={expandedGen5ParentIds}
          onToggleGen5={onToggleGen5}
          showTreeBackground={false}
        />

        {panelMember && (popoverOpen || isPanelClosing) ? (
          <ReferenceMemberFocusPanel
            ref={panelRef}
            member={panelMember}
            members={familyMembers}
            person={popoverPerson}
            visible={popoverOpen && panelVisible}
            anchor={panelAnchor}
            onClose={onClosePopover}
            onExitComplete={handlePanelExitComplete}
          />
        ) : null}
      </div>

      <ReferenceTreeToolbar
        onAction={handleToolbarAction}
        onPrint={onPrint}
        controlsReady={controlsReady}
        zoomOutDisabled={isAtDefaultViewport}
        resetDisabled={isAtDefaultViewport}
        dimmed={shareModalOpen}
      />
    </main>
  );
}
