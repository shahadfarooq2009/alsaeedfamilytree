import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../features/family-tree/theme/referenceTree.css';
import type { PersonDetail, PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { getPerson, updatePerson } from '../../services/personService';
import { parsePresetAvatarId, presetAvatarPhotoUrl } from '../../assets/avatars/catalog';
import { toApiError } from '../../lib/api';
import { AddMemberModal } from './AddMemberModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import { ReferencePersonModal } from './ReferencePersonModal';
import { ReferenceTreeCanvas } from './ReferenceTreeCanvas';
import type { ToolbarAction } from './ReferenceTreeToolbar';

interface ReferenceTreeAppProps {
  familyName?: string | null;
  familyId: number;
  familyMembers: FamilyMemberInput[];
  onTreeRefresh: () => Promise<void>;
}

export function ReferenceTreeApp({
  familyName,
  familyId,
  familyMembers,
  onTreeRefresh,
}: ReferenceTreeAppProps) {
  const canvasRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPerson, setPopoverPerson] = useState<PersonDetail | PersonSummary | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [avatarEditMemberId, setAvatarEditMemberId] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  const normalizedMembers = familyMembers;

  const isFirstMember = normalizedMembers.length === 0;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 1900);
  }, []);

  const closePopover = useCallback(() => {
    setSelectedId(null);
    setPopoverOpen(false);
    setPopoverPerson(null);
    setFullProfileOpen(false);
  }, []);

  const revealMemberPopover = useCallback((id: number, person: PersonSummary | null = null) => {
    setSelectedId(id);
    setPopoverPerson(person);
    setPopoverOpen(true);
  }, []);

  const selectMember = useCallback((id: number) => {
    if (selectedId === id && popoverOpen) {
      closePopover();
      return;
    }
    revealMemberPopover(id);
  }, [closePopover, popoverOpen, revealMemberPopover, selectedId]);

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

  const handleSearchResultsChange = useCallback((results: PersonSummary[]) => {
    const ids = results.map((person) => person.id);
    setHighlightIds(ids);
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    if (ids.length > 0) {
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightIds([]);
        highlightTimerRef.current = null;
      }, 1000);
    }
  }, []);

  const handleMemberAdded = useCallback(
    async () => {
      await onTreeRefresh();
      showToast('تمت إضافة الفرد — يمكنك إضافة فرد آخر');
    },
    [onTreeRefresh, showToast],
  );

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
        const url = window.location.href;
        if (navigator.share) {
          void navigator.share({ title: 'شجرة العائلة', url }).catch(() => undefined);
        } else if (navigator.clipboard) {
          void navigator.clipboard.writeText(url).then(() => showToast('تم نسخ رابط الشجرة'));
        } else {
          showToast('تم تجهيز رابط المشاركة');
        }
      }
    },
    [showToast],
  );

  const handleSearchSelect = useCallback((person: PersonSummary) => {
    revealMemberPopover(person.id, person);
    setHighlightIds([person.id]);
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightIds([]);
      highlightTimerRef.current = null;
    }, 1000);
  }, [revealMemberPopover]);

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
        } else if (popoverOpen) {
          closePopover();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [addMemberOpen, avatarEditMemberId, closePopover, fullProfileOpen, popoverOpen]);

  useEffect(() => () => {
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  return (
    <div className="reference-tree-app" id="app" dir="rtl" lang="ar">
      <ReferenceTreeCanvas
        familyMembers={familyMembers}
        familyName={familyName}
        familyId={familyId}
        selectedId={selectedId}
        highlightIds={highlightIds}
        popoverPerson={popoverPerson}
        popoverOpen={popoverOpen}
        canvasRef={canvasRef}
        onSelectMember={selectMember}
        onToolbarAction={handleToolbarAction}
        onAddMember={() => setAddMemberOpen(true)}
        onSearchResultsChange={handleSearchResultsChange}
        onSearchSelect={handleSearchSelect}
        onClosePopover={closePopover}
        onViewFullProfile={() => setFullProfileOpen(true)}
        onEditMemberAvatar={setAvatarEditMemberId}
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
        isFirstMember={isFirstMember}
        onClose={() => setAddMemberOpen(false)}
        onSuccess={() => void handleMemberAdded()}
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
