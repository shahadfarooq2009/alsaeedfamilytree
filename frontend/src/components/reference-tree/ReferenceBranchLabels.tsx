import type { BranchLabel } from '../../utils/treeLayout/types';

interface ReferenceBranchLabelsProps {
  labels: BranchLabel[];
}

export function ReferenceBranchLabels({ labels }: ReferenceBranchLabelsProps) {
  return (
    <div className="branch-labels family-tree-map-labels" id="branchLabels">
      {labels.map((label) => (
        <div
          key={`${label.parentId}-${label.text}`}
          className="branch-label family-group-label"
          style={{
            left: `${label.x}px`,
            top: `${label.y}px`,
            width: label.width ? `${label.width}px` : undefined,
          }}
        >
          {label.text}
        </div>
      ))}
    </div>
  );
}
