import familyLogo from '../../assets/family-tree/reference/family-logo.png';
import { IconAddPerson } from '../reference-tree/referenceTreeIcons';
import { ReferenceTreeSearch } from '../reference-tree/ReferenceTreeSearch';
import type { PersonSummary } from '../../types/person';
import { getFamilyDataLabel } from '../../utils/familyDataLabel';

interface ForestPageHeaderProps {
  familyName?: string | null;
  familyId: number;
  highlightIds: number[];
  onAddMember?: () => void;
  onSearchSelect: (person: PersonSummary) => void;
  onSearchEnter: (query: string, results: PersonSummary[]) => void;
  onSearchClear: () => void;
}

export function ForestPageHeader({
  familyName,
  familyId,
  highlightIds,
  onAddMember,
  onSearchSelect,
  onSearchEnter,
  onSearchClear,
}: ForestPageHeaderProps) {
  const displayName = familyName?.trim() || 'عائلة السعيد';
  const dataLabel = getFamilyDataLabel(displayName);

  return (
    <header className="tree-header family-forest-page-header">
      <div className="tree-header-brand">
        <div className="tree-header-brand-logo" aria-hidden>
          <img src={familyLogo} alt="" className="tree-header-brand-img" />
        </div>
        <div className="tree-header-brand-text">
          <strong>{displayName}</strong>
          {dataLabel ? <span>{dataLabel}</span> : null}
        </div>
      </div>

      <ReferenceTreeSearch
        familyId={familyId}
        highlightIds={highlightIds}
        onSelect={onSearchSelect}
        onEnter={onSearchEnter}
        onQueryClear={onSearchClear}
      />

      <div className="tree-header-actions family-forest-page-header__actions">
        {onAddMember ? (
          <button type="button" className="tree-header-add" onClick={onAddMember}>
            <IconAddPerson />
            <span>إضافة فرد</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
