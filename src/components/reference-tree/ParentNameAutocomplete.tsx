import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { filterMembersByNameQuery, filterNamesByQuery } from '../../utils/filterMembersByNameQuery';
import { getMemberDisplayNameWithFather } from '../../utils/memberDisplayInfo';
import { getMemberFirstName } from '../../utils/normalizeFamilyData';
import { IconSearch } from './referenceTreeIcons';

function isFirstNameMatch(fullName: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return getMemberFirstName(fullName) === trimmed.split(/\s+/)[0];
}

interface ParentNameAutocompleteProps {
  label: string;
  labelIcon?: ReactNode;
  placeholder: string;
  members: FamilyMemberInput[];
  lookupMembers?: FamilyMemberInput[];
  familyId?: number;
  extraNames?: string[];
  value: string;
  onChange: (value: string) => void;
  onSelectMember?: (member: FamilyMemberInput | null) => void;
  hint?: ReactNode;
}

export function ParentNameAutocomplete({
  label,
  labelIcon,
  placeholder,
  members,
  lookupMembers,
  familyId,
  extraNames = [],
  value,
  onChange,
  onSelectMember,
  hint,
}: ParentNameAutocompleteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedMemberRef = useRef<FamilyMemberInput | null>(null);
  const nameLookupMembers = lookupMembers ?? members;

  const memberDisplayName = (member: FamilyMemberInput) => (
    getMemberDisplayNameWithFather(member, nameLookupMembers, familyId)
  );

  const memberResults = useMemo(
    () => filterMembersByNameQuery(members, value),
    [members, value],
  );

  const extraResults = useMemo(
    () => filterNamesByQuery(extraNames, value),
    [extraNames, value],
  );

  const handleSelectName = (name: string) => {
    selectedMemberRef.current = null;
    onChange(name);
    onSelectMember?.(null);
    setOpen(false);
  };

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

  const handleValueChange = (nextValue: string) => {
    onChange(nextValue);
    setOpen(Boolean(nextValue.trim()));

    if (
      selectedMemberRef.current
      && normalizeForCompare(nextValue) !== normalizeForCompare(memberDisplayName(selectedMemberRef.current))
    ) {
      selectedMemberRef.current = null;
      onSelectMember?.(null);
    }
  };

  const handleSelect = (member: FamilyMemberInput) => {
    selectedMemberRef.current = member;
    onChange(memberDisplayName(member));
    onSelectMember?.(member);
    setOpen(false);
  };

  const showResults = open && value.trim().length > 0;

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
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => handleValueChange(event.target.value)}
            onFocus={() => {
              if (value.trim()) setOpen(true);
            }}
          />
          <span className="add-member-input-wrap__icon" aria-hidden>
            <IconSearch />
          </span>
        </div>

        {showResults && (
          <ul className="add-member-parent-results" role="listbox">
            {memberResults.length === 0 && extraResults.length === 0 ? (
              <li className="add-member-parent-empty">لا توجد أسماء مطابقة</li>
            ) : (
              <>
                {memberResults.map((member) => (
                  <li key={`member-${member.id}`} role="option">
                    <button
                      type="button"
                      onClick={() => handleSelect(member)}
                    >
                      <span>{memberDisplayName(member)}</span>
                      <small>
                        {isFirstNameMatch(member.fullName, value)
                          ? 'تطابق الاسم الأول'
                          : 'تطابق جزئي'}
                        {' • '}
                        الجيل {member.generation}
                      </small>
                    </button>
                  </li>
                ))}
                {extraResults.map((name) => (
                  <li key={`name-${name}`} role="option">
                    <button
                      type="button"
                      onClick={() => handleSelectName(name)}
                    >
                      <span>{name}</span>
                      <small>زوج مسجّل في بيانات العائلة</small>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
      {hint}
    </label>
  );
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase();
}
