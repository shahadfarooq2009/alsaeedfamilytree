import '../../features/family-tree/theme/referenceTree.css';

const TREE_ROWS = [
  { count: 1, y: '18%' },
  { count: 5, y: '38%' },
  { count: 7, y: '58%' },
  { count: 9, y: '76%' },
] as const;

export function ReferenceTreeSkeleton() {
  return (
    <div className="reference-tree-app reference-tree-skeleton" dir="rtl" lang="ar">
      <main
        className="canvas family-tree-scene reference-tree-skeleton__scene"
        aria-busy="true"
        aria-label="جاري تحميل شجرة العائلة"
      >
        <div className="tree-top-gradient" aria-hidden />

        <div className="reference-tree-skeleton__header" aria-hidden>
          <div className="reference-tree-skeleton__brand">
            <div className="skeleton-shimmer skeleton-circle" />
            <div className="reference-tree-skeleton__brand-text">
              <div className="skeleton-shimmer skeleton-line skeleton-line--title" />
              <div className="skeleton-shimmer skeleton-line skeleton-line--subtitle" />
            </div>
          </div>
          <div className="skeleton-shimmer skeleton-search" />
          <div className="skeleton-shimmer skeleton-btn" />
        </div>

        <div className="reference-tree-skeleton__canvas" aria-hidden>
          <div className="skeleton-shimmer skeleton-tree-bg" />

          {TREE_ROWS.map((row) => (
            <div
              key={row.y}
              className="reference-tree-skeleton__row"
              style={{ top: row.y }}
            >
              {Array.from({ length: row.count }, (_, index) => (
                <div
                  key={`${row.y}-${index}`}
                  className={`skeleton-shimmer skeleton-node${row.count === 1 ? ' skeleton-node--founder' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="reference-tree-skeleton__toolbar" aria-hidden>
          <div className="skeleton-shimmer skeleton-pill skeleton-pill--wide" />
          <div className="reference-tree-skeleton__toolbar-group">
            <div className="skeleton-shimmer skeleton-pill" />
            <div className="skeleton-shimmer skeleton-pill" />
            <div className="skeleton-shimmer skeleton-pill" />
          </div>
        </div>
      </main>
    </div>
  );
}
