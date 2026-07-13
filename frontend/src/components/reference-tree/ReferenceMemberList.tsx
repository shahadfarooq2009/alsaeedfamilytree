import { useMemo, useState } from 'react';
import type { PrototypeMember } from './prototypeMembers';
import { IconChevron, IconSearch } from './referenceTreeIcons';

const COLLAPSED = 8;

interface ReferenceMemberListProps {
  members: PrototypeMember[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  highlightedId: number | null;
  onSelect: (id: number) => void;
}

export function ReferenceMemberList({
  members,
  searchQuery,
  onSearchChange,
  highlightedId,
  onSelect,
}: ReferenceMemberListProps) {
  const [expanded, setExpanded] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return members;
    return members.filter((member) => member.fullName.includes(query));
  }, [members, searchQuery]);

  const visibleMembers = useMemo(() => {
    if (expanded || searchQuery.trim()) return filteredMembers;
    return filteredMembers.slice(0, COLLAPSED);
  }, [expanded, filteredMembers, searchQuery]);

  const showMoreButton = !searchQuery.trim() && members.length > COLLAPSED;

  return (
    <section className="panel panel-list">
      <h2 className="panel-head panel-head-list">أفراد العائلة</h2>
      <div className="search">
        <IconSearch />
        <input
          type="text"
          id="searchInput"
          placeholder="ابحث عن اسم..."
          autoComplete="off"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <ul className="member-list" id="memberList">
        {visibleMembers.map((member) => (
          <li
            key={member.id}
            className={`member-row${highlightedId === member.id ? ' hit' : ''}`}
            data-id={member.id}
            onClick={() => onSelect(member.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(member.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span className="row-name">{member.fullName}</span>
            <span className="row-relation">{member.relationLabel}</span>
            <span className="row-badge">{member.initial}</span>
          </li>
        ))}
      </ul>
      {showMoreButton && (
        <button
          type="button"
          className={`show-more${expanded ? ' open' : ''}`}
          id="showMore"
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{expanded ? 'عرض أقل' : 'عرض المزيد'}</span>
          <IconChevron />
        </button>
      )}
    </section>
  );
}
