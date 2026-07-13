import { memo, type CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

import type { ForestBranchPanelData } from '../../utils/familyForest/buildFamilyForestLayout';

function ForestBranchPanelComponent({ data }: NodeProps<Node<ForestBranchPanelData>>) {
  if (!data) return null;

  return (
    <div
      className={`family-forest-branch-panel is-panel-${data.columnIndex}`}
      style={{
        '--branch-color': data.branchColor,
      } as CSSProperties}
      aria-label={data.branchName ? `فرع ${data.branchName} — الجيل الثالث` : undefined}
    >
      {data.memberCount > 0 ? (
        <div className="family-forest-branch-panel__footer">
          إجمالي أفراد الفرع: <strong>{data.memberCount}</strong>
        </div>
      ) : null}
    </div>
  );
}

export const ForestBranchPanel = memo(ForestBranchPanelComponent);
