import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { getMemberDisplayNameWithFather } from '../../utils/memberDisplayInfo';
import { suggestKinshipMembers } from '../../utils/kinship/resolveKinshipMember';

export interface KinshipNameFieldHandle {
  closeSuggestions: () => void;
}

interface KinshipNameFieldProps {
  label: string;
  placeholder: string;
  value: string;
  members: FamilyMemberInput[];
  familyId: number;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export const KinshipNameField = forwardRef<KinshipNameFieldHandle, KinshipNameFieldProps>(
  function KinshipNameField({
    label,
    placeholder,
    value,
    members,
    familyId,
    onChange,
    onSubmit,
  }, ref) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);

    useImperativeHandle(ref, () => ({
      closeSuggestions: () => {
        setOpen(false);
        setFocused(false);
      },
    }), []);

    const suggestions = useMemo(
      () => (value.trim() ? suggestKinshipMembers(members, value, familyId, 8) : []),
      [familyId, members, value],
    );

    useEffect(() => {
      if (!open) return undefined;

      const onPointerDown = (event: MouseEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
          setFocused(false);
        }
      };

      window.addEventListener('mousedown', onPointerDown);
      return () => window.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    const showDropdown = focused && open && value.trim().length > 0;

    return (
      <div className="kinship-sidebar__field" ref={rootRef}>
        <span className="kinship-sidebar__label">{label}</span>
        <div className="kinship-sidebar__input-wrap">
          <input
            type="text"
            className="kinship-sidebar__input"
            placeholder={placeholder}
            value={value}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
              setFocused(true);
            }}
            onFocus={() => {
              setFocused(true);
              if (value.trim()) setOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setFocused(false);
                setOpen(false);
              }, 120);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                setOpen(false);
                setFocused(false);
                onSubmit?.();
              }
              if (event.key === 'Escape') {
                setOpen(false);
                setFocused(false);
              }
            }}
          />

          {showDropdown ? (
            <ul className="kinship-sidebar__suggestions" id={listId} role="listbox">
              {suggestions.length === 0 ? (
                <li className="kinship-sidebar__suggestion-empty">لا توجد نتائج مطابقة</li>
              ) : (
                suggestions.map((member) => {
                  const displayName = getMemberDisplayNameWithFather(member, members, familyId);
                  return (
                    <li key={member.id} role="option">
                      <button
                        type="button"
                        className="kinship-sidebar__suggestion"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange(displayName);
                          setOpen(false);
                          setFocused(false);
                        }}
                      >
                        <span className="kinship-sidebar__suggestion-name">{displayName}</span>
                        {member.fullName !== displayName ? (
                          <span className="kinship-sidebar__suggestion-meta">{member.fullName}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
      </div>
    );
  },
);
