import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../features/family-tree/theme/referenceTree.css';
import '../../components/family-tree-map/FamilyTreeMap.css';
import type { PersonDetail, PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { findMemberIdsByNameQuery } from '../../utils/familyTreeSearch';
import {
  ADDED_MEMBER_GLOW_MS,
  getGen5ParentToExpandForMember,
} from '../../utils/animateAddedMember';
import { getPerson, updatePerson } from '../../services/personService';
import { parsePresetAvatarId, presetAvatarPhotoUrl } from '../../assets/avatars/catalog';
import { toApiError } from '../../lib/api';
import {
  loadTreeBackgroundSettings,
  saveTreeBackgroundSettings,
  type TreeBackgroundSettings,
} from '../../utils/treeBackgroundStorage';
import { AddMemberModal } from './AddMemberModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import { PrintFamilyTreeModal } from './PrintFamilyTreeModal';
import { ReferencePersonModal } from './ReferencePersonModal';
import { ReferenceTreeCanvas } from './ReferenceTreeCanvas';
import { ShareFamilyTreeModal } from './ShareFamilyTreeModal';
import { TreeBackgroundPicker } from './TreeBackgroundPicker';
import { KinshipSidebar } from '../family-forest/KinshipSidebar';
import { IconKinship } from './referenceTreeIcons';
import type { FamilyTreeFlowControls, FamilyTreeFlowHandle } from './FamilyTreeFlow';
import type { ToolbarAction } from './ReferenceTreeToolbar';
import type { FamilyTreeLayoutOptions } from '../../utils/buildFamilyTreeFlowLayout';
import { filterBaseGenerationMembers, DEFAULT_MAX_BASE_GENERATIONS } from '../../utils/gen5Expansion';
import { invalidateBaseTreeLayoutCache } from '../../utils/buildFamilyTreeFlowLayout';
import { resolvePrimaryTreeParentId } from '../../utils/treeLayout/primaryTreeParent';
import { getDisplayGeneration, getGenerationBaseline } from '../../utils/progressiveTreeDisclosure';

interface ReferenceTreeAppProps {
  familyName?: string | null;
  familyId: number;
  founderPersonId?: number | null;
  familyMembers: FamilyMemberInput[];
  onTreeRefresh: () => Promise<void>;
  onOpenForest?: () => void;
}

export function ReferenceTreeApp({
  familyName,
  familyId,
  founderPersonId = null,
  familyMembers,
  onTreeRefresh,
  onOpenForest,
}: ReferenceTreeAppProps) {
  const canvasRef = useRef<HTMLElement>(null);
  const treeExportRef = useRef<HTMLElement>(null);
  const flowHandleRef = useRef<FamilyTreeFlowHandle | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [kinshipSidebarOpen, setKinshipSidebarOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPerson, setPopoverPerson] = useState<PersonDetail | PersonSummary | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [avatarEditMemberId, setAvatarEditMemberId] = useState<number | null>(null);
  const [backgroundSettings, setBackgroundSettings] = useState<TreeBackgroundSettings>(() =>
    loadTreeBackgroundSettings(familyId),
  );
  const highlightTimerRef = useRef<number | null>(null);
  const pendingAddedMemberIdRef = useRef<number | null>(null);
  const addedMemberGlowTimerRef = useRef<number | null>(null);
  const [justAddedMemberId, setJustAddedMemberId] = useState<number | null>(null);
  const pendingFocusIdRef = useRef<number | null>(null);
  const pendingSearchPersonRef = useRef<PersonSummary | null>(null);
  const selectionAwaitingDismissRef = useRef(false);
  const flowControlsRef = useRef<FamilyTreeFlowControls | null>(null);
  const [expandedGen5ParentIds, setExpandedGen5ParentIds] = useState<Set<number>>(() => new Set());

  const baseMembers = useMemo(
    () => filterBaseGenerationMembers(familyMembers),
    [familyMembers],
  );

  const layoutOptions = useMemo<FamilyTreeLayoutOptions>(() => ({
    allMembers: familyMembers,
    expandedGen5ParentIds,
  }), [expandedGen5ParentIds, familyMembers]);

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

  const normalizedMembers = familyMembers;

  const hasFounder = founderPersonId != null
    || normalizedMembers.some((member) => member.isFamilyHead);

  useEffect(() => {
    invalidateBaseTreeLayoutCache();
  }, [familyMembers]);

  useEffect(() => {
    setBackgroundSettings(loadTreeBackgroundSettings(familyId));
    setExpandedGen5ParentIds(new Set());
  }, [familyId]);

  useEffect(() => {
    saveTreeBackgroundSettings(familyId, backgroundSettings);
  }, [backgroundSettings, familyId]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 1900);
  }, []);

  const clearMemberSelection = useCallback(() => {
    selectionAwaitingDismissRef.current = false;
    pendingFocusIdRef.current = null;
    pendingSearchPersonRef.current = null;
    setSelectedId(null);
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
    flowControlsRef.current?.fitView();
  }, []);

  const closePopover = useCallback(() => {
    selectionAwaitingDismissRef.current = false;
    pendingFocusIdRef.current = null;
    setSelectedId(null);
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
    flowControlsRef.current?.fitView();
  }, []);

  const dismissPopoverKeepSelection = useCallback(() => {
    pendingFocusIdRef.current = null;
    pendingSearchPersonRef.current = null;
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
    if (selectedId != null) {
      selectionAwaitingDismissRef.current = true;
    }
  }, [selectedId]);

  const handleMapPaneClick = useCallback(() => {
    if (selectionAwaitingDismissRef.current) {
      clearMemberSelection();
      return;
    }
    closePopover();
  }, [clearMemberSelection, closePopover]);

  const revealMemberPopover = useCallback((id: number, person: PersonSummary | null = null) => {
    setSelectedId(id);
    setPopoverPerson(person);
    setPopoverOpen(true);
  }, []);

  const beginMemberFocus = useCallback((id: number): boolean => {
    if (selectionAwaitingDismissRef.current) {
      selectionAwaitingDismissRef.current = false;
      if (selectedId === id) {
        clearMemberSelection();
        return false;
      }
    }

    if (selectedId === id && popoverOpen) {
      pendingFocusIdRef.current = null;
      closePopover();
      return false;
    }

    pendingFocusIdRef.current = id;
    setSelectedId(id);
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
    return true;
  }, [clearMemberSelection, closePopover, popoverOpen, selectedId]);

  const completeMemberFocus = useCallback((id: number) => {
    if (pendingFocusIdRef.current !== id) return;
    pendingFocusIdRef.current = null;
    const person = pendingSearchPersonRef.current?.id === id
      ? pendingSearchPersonRef.current
      : null;
    pendingSearchPersonRef.current = null;
    revealMemberPopover(id, person);
  }, [revealMemberPopover]);

  useEffect(() => {
    if (!popoverOpen || selectedId == null) {
      setPopoverPerson(null);
      return undefined;
    }

    let active = true;
    void getPerson(familyId, selectedId)
      .then((response) => {
        if (active) setPopoverPerson(response.data);
      })
      .catch(() => {
        if (active) setPopoverPerson(null);
      });

    return () => {
      active = false;
    };
  }, [familyId, popoverOpen, selectedId]);

  const handleFlowControlsReady = useCallback((controls: FamilyTreeFlowControls) => {
    flowControlsRef.current = controls;
  }, []);

  const handleSearchClear = useCallback(() => {
    setHighlightIds([]);
  }, []);

  const handleSearchEnter = useCallback((query: string, _results: PersonSummary[]) => {
    const ids = findMemberIdsByNameQuery(familyMembers, query);
    setHighlightIds(ids);
    setSelectedId(null);
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
    pendingFocusIdRef.current = null;
    pendingSearchPersonRef.current = null;
  }, [familyMembers]);

  const handleSearchSelect = useCallback((person: PersonSummary) => {
    pendingSearchPersonRef.current = person;
    setHighlightIds([person.id]);

    const member = familyMembers.find((entry) => entry.id === person.id);
    if (member) {
      const baseline = getGenerationBaseline(familyMembers);
      if (getDisplayGeneration(member, baseline) === DEFAULT_MAX_BASE_GENERATIONS + 1) {
        const parentId = resolvePrimaryTreeParentId(member);
        if (parentId != null) {
          setExpandedGen5ParentIds((current) => new Set(current).add(parentId));
        }
      }
    }

    flowControlsRef.current?.focusMember(person.id);
  }, [familyMembers]);

  const handleMemberAdded = useCallback(
    async (personId: number) => {
      pendingAddedMemberIdRef.current = personId;
      await onTreeRefresh();
      showToast('تمت إضافة الفرد بنجاح');
    },
    [onTreeRefresh, showToast],
  );

  useEffect(() => {
    const personId = pendingAddedMemberIdRef.current;
    if (personId == null) return;

    const member = familyMembers.find((entry) => entry.id === personId);
    if (!member) return;

    pendingAddedMemberIdRef.current = null;
    setHighlightIds([personId]);
    setJustAddedMemberId(personId);

    if (addedMemberGlowTimerRef.current != null) {
      window.clearTimeout(addedMemberGlowTimerRef.current);
    }
    addedMemberGlowTimerRef.current = window.setTimeout(() => {
      setJustAddedMemberId(null);
      setHighlightIds([]);
      addedMemberGlowTimerRef.current = null;
    }, ADDED_MEMBER_GLOW_MS);

    const gen5ParentId = getGen5ParentToExpandForMember(personId, familyMembers);
    if (gen5ParentId != null) {
      setExpandedGen5ParentIds((current) => new Set(current).add(gen5ParentId));
    }
  }, [familyMembers]);

  useEffect(() => () => {
    if (addedMemberGlowTimerRef.current != null) {
      window.clearTimeout(addedMemberGlowTimerRef.current);
    }
  }, []);

  const avatarEditMember = useMemo(
    () => (avatarEditMemberId != null
      ? normalizedMembers.find((member) => member.id === avatarEditMemberId) ?? null
      : null),
    [avatarEditMemberId, normalizedMembers],
  );

  const handleAvatarSelectForMember = useCallback(
    async (avatarId: string) => {
      if (avatarEditMemberId == null) return;
      try {
        await updatePerson(familyId, avatarEditMemberId, {
          photo_url: presetAvatarPhotoUrl(avatarId),
        });
        await onTreeRefresh();
        if (popoverOpen && selectedId === avatarEditMemberId) {
          const response = await getPerson(familyId, avatarEditMemberId);
          setPopoverPerson(response.data);
        }
        showToast('تم تحديث الصورة الشخصية');
      } catch (err) {
        showToast(toApiError(err).message);
      } finally {
        setAvatarEditMemberId(null);
      }
    },
    [avatarEditMemberId, familyId, onTreeRefresh, popoverOpen, selectedId, showToast],
  );

  const handleToolbarAction = useCallback(
    (action: ToolbarAction) => {
      if (action === 'fullscreen') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!document.fullscreenElement) {
          void canvas.requestFullscreen?.();
        } else {
          void document.exitFullscreen?.();
        }
        return;
      }
      if (action === 'share') {
        setShareModalOpen(true);
        return;
      }
      if (action === 'print') {
        setPrintModalOpen(true);
      }
    },
    [],
  );

  const fullProfileMember = useMemo(
    () => (fullProfileOpen && selectedId != null
      ? normalizedMembers.find((member) => member.id === selectedId) ?? null
      : null),
    [fullProfileOpen, normalizedMembers, selectedId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (fullProfileOpen) {
          setFullProfileOpen(false);
        } else if (avatarEditMemberId != null) {
          setAvatarEditMemberId(null);
        } else if (addMemberOpen) {
          setAddMemberOpen(false);
        } else if (shareModalOpen) {
          setShareModalOpen(false);
        } else if (printModalOpen) {
          setPrintModalOpen(false);
        } else if (kinshipSidebarOpen) {
          setKinshipSidebarOpen(false);
        } else if (popoverOpen) {
          closePopover();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [addMemberOpen, avatarEditMemberId, closePopover, fullProfileOpen, kinshipSidebarOpen, popoverOpen, printModalOpen, shareModalOpen]);

  useEffect(() => () => {
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  return (
    <div className="reference-tree-app" id="app" dir="rtl" lang="ar">
      <ReferenceTreeCanvas
        familyMembers={familyMembers}
        visibleMembers={baseMembers}
        layoutOptions={layoutOptions}
        expandedGen5ParentIds={expandedGen5ParentIds}
        onToggleGen5={toggleGen5}
        familyName={familyName}
        familyId={familyId}
        selectedId={selectedId}
        highlightIds={highlightIds}
        justAddedMemberId={justAddedMemberId}
        popoverPerson={popoverPerson}
        popoverOpen={popoverOpen}
        canvasRef={canvasRef}
        exportTargetRef={treeExportRef}
        onFlowHandleReady={(handle) => {
          flowHandleRef.current = handle;
        }}
        onBeginMemberFocus={beginMemberFocus}
        onCompleteMemberFocus={completeMemberFocus}
        onToolbarAction={handleToolbarAction}
        onPrint={() => setPrintModalOpen(true)}
        onAddMember={() => setAddMemberOpen(true)}
        onSearchSelect={handleSearchSelect}
        onSearchEnter={handleSearchEnter}
        onSearchClear={handleSearchClear}
        onFlowControlsReady={handleFlowControlsReady}
        onClosePopover={closePopover}
        onMapPaneClick={handleMapPaneClick}
        onDismissPopoverKeepSelection={dismissPopoverKeepSelection}
        onEditMemberAvatar={setAvatarEditMemberId}
        onOpenForest={onOpenForest}
        shareModalOpen={shareModalOpen || printModalOpen}
        backgroundSettings={backgroundSettings}
      />

      <div className="tree-bottom-left-tools">
        <TreeBackgroundPicker
          settings={backgroundSettings}
          onChange={setBackgroundSettings}
        />
        <button
          type="button"
          className="pill tree-kinship-btn"
          onClick={() => setKinshipSidebarOpen(true)}
        >
          <IconKinship />
          <span>صلة القرابة</span>
        </button>
      </div>

      <KinshipSidebar
        open={kinshipSidebarOpen}
        members={normalizedMembers}
        familyId={familyId}
        onClose={() => setKinshipSidebarOpen(false)}
      />

      <ShareFamilyTreeModal
        open={shareModalOpen}
        familyId={familyId}
        familyName={familyName}
        memberCount={normalizedMembers.length}
        exportTargetRef={treeExportRef}
        flowHandleRef={flowHandleRef}
        onClose={() => setShareModalOpen(false)}
        onToast={showToast}
      />

      <PrintFamilyTreeModal
        open={printModalOpen}
        familyName={familyName}
        members={normalizedMembers}
        exportTargetRef={treeExportRef}
        flowHandleRef={flowHandleRef}
        onClose={() => setPrintModalOpen(false)}
        onToast={showToast}
      />

      <ReferencePersonModal
        member={fullProfileMember}
        members={normalizedMembers}
        open={fullProfileOpen}
        onClose={() => setFullProfileOpen(false)}
      />

      <AddMemberModal
        open={addMemberOpen}
        familyId={familyId}
        members={normalizedMembers}
        hasFounder={hasFounder}
        onClose={() => setAddMemberOpen(false)}
        onSuccess={(personId) => void handleMemberAdded(personId)}
      />

      <AvatarPickerModal
        open={avatarEditMemberId != null}
        selectedAvatarId={parsePresetAvatarId(avatarEditMember?.photoUrl ?? null)}
        preferredGender={avatarEditMember?.gender ?? null}
        onClose={() => setAvatarEditMemberId(null)}
        onSelect={(avatarId) => void handleAvatarSelectForMember(avatarId)}
      />

      <div className={`toast${toastMessage ? ' show' : ''}`} id="toast">
        {toastMessage}
      </div>
    </div>
  );
}
