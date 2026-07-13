import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

import { toApiError } from '../../lib/api';
import { updatePerson } from '../../services/personService';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { useForestCardHover } from './ForestCardHoverContext';

interface ForestInlineEditableNameProps {
  memberId: number;
  fullName: string;
  displayName: string;
  className?: string;
}

function buildNamePayload(value: string) {
  const trimmed = value.trim();
  return {
    first_name: getMemberFirstName(trimmed),
    full_name: trimmed,
  };
}

export function ForestInlineEditableName({
  memberId,
  fullName,
  displayName,
  className = 'family-forest-node__name',
}: ForestInlineEditableNameProps) {
  const context = useForestCardHover();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullName);
  const [saving, setSaving] = useState(false);
  const [localDisplay, setLocalDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(fullName);
      setLocalDisplay(null);
    }
  }, [editing, fullName]);

  const startEditing = useCallback((event: MouseEvent) => {
    if (!context?.editable) return;
    event.stopPropagation();
    setDraft(fullName);
    setEditing(true);
  }, [context?.editable, fullName]);

  useEffect(() => {
    if (!editing) return undefined;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  const cancelEditing = useCallback(() => {
    setDraft(fullName);
    setEditing(false);
  }, [fullName]);

  const saveName = useCallback(async () => {
    if (!context?.editable || saving) return;

    const trimmed = draft.trim();
    if (!trimmed) {
      cancelEditing();
      return;
    }

    if (trimmed === fullName.trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updatePerson(context.familyId, memberId, buildNamePayload(trimmed));
      setLocalDisplay(trimmed);
      setEditing(false);
      await context.onMemberUpdated();
      context.onToast?.('تم تحديث الاسم');
    } catch (err) {
      context.onToast?.(toApiError(err).message);
      setDraft(fullName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [cancelEditing, context, draft, fullName, memberId, saving]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveName();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  }, [cancelEditing, saveName]);

  if (!context?.editable) {
    return (
      <span className={className} title={fullName}>
        {displayName}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${className} family-forest-node__name-input`}
        type="text"
        value={draft}
        disabled={saving}
        dir="rtl"
        aria-label="تعديل الاسم"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void saveName()}
        onKeyDown={onKeyDown}
      />
    );
  }

  const shownName = localDisplay ?? displayName;

  return (
    <button
      type="button"
      className={`${className} family-forest-node__name-btn`}
      title={`${fullName} — انقر للتعديل`}
      onClick={startEditing}
    >
      {shownName}
    </button>
  );
}
