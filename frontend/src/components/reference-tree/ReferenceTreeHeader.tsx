import familyLogo from '../../assets/family-tree/reference/family-logo.png';
import { IconAddPerson } from './referenceTreeIcons';
import { ReferenceTreeSearch } from './ReferenceTreeSearch';
import type { PersonSummary } from '../../types/person';

interface ReferenceTreeHeaderProps {
  familyName?: string | null;
  familyId: number;
  memberCount: number;
  highlightIds: number[];
  onAddMember: () => void;
  onSearchResultsChange: (results: PersonSummary[]) => void;
  onSearchSelect: (person: PersonSummary) => void;
}

export function ReferenceTreeHeader({
  familyName,
  familyId,
  memberCount,
  highlightIds,
  onAddMember,
  onSearchResultsChange,
  onSearchSelect,
}: ReferenceTreeHeaderProps) {
  const displayName = familyName?.trim() || 'عائلة السعيد';

  return (
    <header className="tree-header">
      <button type="button" className="tree-header-add" onClick={onAddMember}>
        <IconAddPerson />
        <span>إضافة فرد</span>
      </button>

      <ReferenceTreeSearch
        familyId={familyId}
        highlightIds={highlightIds}
        onResultsChange={onSearchResultsChange}
        onSelect={onSearchSelect}
      />

      <div className="tree-header-brand">
        <div className="tree-header-brand-logo" aria-hidden>
          <img src={familyLogo} alt="" className="tree-header-brand-img" />
        </div>
        <div className="tree-header-brand-text">
          <strong>{displayName}</strong>
          <span>
            {memberCount} فرد · عائلة #{familyId}
          </span>
        </div>
      </div>
    </header>
  );
}
