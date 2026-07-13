interface FamilyTreeDisclosureBreadcrumbProps {
  items: Array<{ key: string; label: string; stackIndex: number }>;
  onNavigate: (stackIndex: number) => void;
  onBack: () => void;
}

export function FamilyTreeDisclosureBreadcrumb({
  items,
  onNavigate,
  onBack,
}: FamilyTreeDisclosureBreadcrumbProps) {
  if (items.length <= 1) return null;

  return (
    <nav className="family-tree-disclosure-breadcrumb" aria-label="مسار الفرع">
      <button
        type="button"
        className="family-tree-disclosure-breadcrumb__back"
        onClick={onBack}
      >
        ← رجوع
      </button>
      <ol className="family-tree-disclosure-breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.key} className="family-tree-disclosure-breadcrumb__item">
              {isLast ? (
                <span className="family-tree-disclosure-breadcrumb__current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="family-tree-disclosure-breadcrumb__link"
                  onClick={() => onNavigate(item.stackIndex)}
                >
                  {item.label}
                </button>
              )}
              {!isLast ? (
                <span className="family-tree-disclosure-breadcrumb__sep" aria-hidden>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
