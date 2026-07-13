import { Link } from 'react-router-dom';

import type { FamilyDetails } from '../../services/personService';
import { getFamilyDataLabel } from '../../utils/familyDataLabel';

interface FamilySwitcherProps {
  families: FamilyDetails[];
  activeFamilyId?: number | null;
  compact?: boolean;
}

export function FamilySwitcher({
  families,
  activeFamilyId,
  compact = false,
}: FamilySwitcherProps) {
  if (families.length === 0) return null;

  return (
    <nav
      className={`family-switcher${compact ? ' family-switcher--compact' : ''}`}
      aria-label="اختيار العائلة"
    >
      <ul className="family-switcher__list">
        {families.map((family) => {
          const isActive = family.id === activeFamilyId;
          const label = getFamilyDataLabel(family.name);

          return (
            <li key={family.id}>
              <Link
                to={`/family-tree/${family.id}?view=forest`}
                className={`family-switcher__item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="family-switcher__name">{family.name}</span>
                {label ? <span className="family-switcher__tag">{label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
