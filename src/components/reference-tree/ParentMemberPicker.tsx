import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { filterMembersByNameQuery } from '../../utils/filterMembersByNameQuery';
import { getMemberDisplayNameWithFather } from '../../utils/memberDisplayInfo';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { IconSearch } from './referenceTreeIcons';

function isFirstNameMatch(fullName: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return getMemberFirstName(fullName) === trimmed.split(/\s+/)[0];
}

interface ParentMemberPickerProps {
  label: string;
  labelIcon?: ReactNode;
  placeholder: string;
  members: FamilyMemberInput[];
  familyId?: number;
  selectedId: number | null;
  onSelect: (member: FamilyMemberInput | null) => void;
}

export function ParentMemberPicker({
  label,
  labelIcon,
  placeholder,
  members,
  familyId,
  selectedId,
  onSelect,
}: ParentMemberPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const memberDisplayName = (member: FamilyMemberInput) => (
    getMemberDisplayNameWithFather(member, members, familyId)
  );

  const selectedMember = useMemo(
    () => (selectedId != null ? members.find((member) => member.id === selectedId) ?? null : null),
    [members, selectedId],
  );

  useEffect(() => {
    if (selectedMember) {
      setQuery(memberDisplayName(selectedMember));
      return;
    }

    if (selectedId == null) {
      setQuery('');
    }
  }, [selectedId, selectedMember]);

  const results = useMemo(
    () => filterMembersByNameQuery(members, query),
    [members, query],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setOpen(Boolean(value.trim()));

    if (selectedMember && normalizeForCompare(value) !== normalizeForCompare(memberDisplayName(selectedMember))) {
      onSelect(null);
    }
  };

  const handleSelect = (member: FamilyMemberInput) => {
    onSelect(member);
    setQuery(memberDisplayName(member));
    setOpen(false);
  };

  const showResults = open && query.trim().length > 0;

  return (
    <label className="add-member-field">
      <span className="add-member-field__label">
        {labelIcon ? (
          <span className="add-member-field__label-icon" aria-hidden>
            {labelIcon}
          </span>
        ) : null}
        <span className="add-member-field__label-text">{label}</span>
      </span>
      <div className="add-member-parent-search" ref={rootRef}>
        <div className="add-member-input-wrap">
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
          />
          <span className="add-member-input-wrap__icon" aria-hidden>
            <IconSearch />
          </span>
        </div>

        {showResults && (
          <ul className="add-member-parent-results" role="listbox">
            {results.length === 0 ? (
              <li className="add-member-parent-empty">لا توجد نتائج مطابقة</li>
            ) : (
              results.map((member) => (
                <li key={member.id} role="option">
                  <button
                    type="button"
                    onClick={() => handleSelect(member)}
                  >
                    <span>{memberDisplayName(member)}</span>
                    <small>
                      {isFirstNameMatch(member.fullName, query)
                        ? 'تطابق الاسم الأول'
                        : 'تطابق جزئي'}
                      {' • '}
                      الجيل {member.generation}
                    </small>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </label>
  );
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase();
}
