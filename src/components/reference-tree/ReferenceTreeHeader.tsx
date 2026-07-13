import familyLogo from '../../assets/family-tree/reference/family-logo.png';
import { IconAddPerson } from './referenceTreeIcons';
import { ReferenceTreeSearch } from './ReferenceTreeSearch';
import type { PersonSummary } from '../../types/person';
import { getFamilyDataLabel } from '../../utils/familyDataLabel';

interface ReferenceTreeHeaderProps {
  familyName?: string | null;
  familyId: number;
  memberCount: number;
  highlightIds: number[];
  onAddMember: () => void;
  onOpenForest?: () => void;
  onSearchSelect: (person: PersonSummary) => void;
  onSearchEnter: (query: string, results: PersonSummary[]) => void;
  onSearchClear: () => void;
}

export function ReferenceTreeHeader({
  familyName,
  familyId,
  memberCount: _memberCount,
  highlightIds,
  onAddMember,
  onOpenForest,
  onSearchSelect,
  onSearchEnter,
  onSearchClear,
}: ReferenceTreeHeaderProps) {
  const displayName = familyName?.trim() || 'عائلة السعيد';
  const dataLabel = getFamilyDataLabel(displayName);

  return (
    <header className="tree-header">
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

      <div className="tree-header-actions">
        {onOpenForest ? (
          <button type="button" className="tree-header-forest" onClick={onOpenForest}>
            <span>غابة العائلة</span>
          </button>
        ) : null}
        <button type="button" className="tree-header-add" onClick={onAddMember}>
          <IconAddPerson />
          <span>إضافة فرد</span>
        </button>
      </div>
    </header>
  );
}
